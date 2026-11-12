import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { isLLMError } from '../../core/llm/errors';
import { getProvider } from '../../core/llm';
import { providerOriginPattern } from '../../core/llm/permissions';
import { aiConfigProblem } from '../../core/llm/settings';
import type { LLMErrorKind } from '../../core/llm/types';
import type { TextPage } from '../../core/summarize/chunk';
import { PROMPT_VERSION } from '../../core/summarize/prompt';
import { summaryCacheKey } from '../../core/summarize/cache-key';
import { runSummaryBatch } from '../../core/summarize/batch';
import {
  findCachedSummary,
  planSummarizeAll,
  sectionLanguage,
  type SummaryConfig,
} from '../../core/summarize/plan';
import { summarizeSection } from '../../core/summarize/run';
import { pagesInSpan, type WorkEstimate } from '../../core/summarize/work';
import type { SummaryRecord } from '../../core/summarize/record';
import { type TocResult } from '../../core/toc';
import { vi } from '../../i18n/vi';
import { loadSummariesForDoc, saveSummary, type TocItem } from '../../storage/db';
import { aiErrorMessage } from '../ai-errors';

import type { RunScope } from './useRunScope';
import type { Analysis } from './types';
import type { AiApi } from './useAiSettings';

type Input = {
  docId: string | null;
  scope: RunScope;
  ai: AiApi;
  /** Có tài liệu đang mở và đọc được. */
  ready: boolean;
  toc: TocResult | null;
  currentSection: TocItem | null;
  extractedPages: readonly TextPage[];
  analysis: Analysis;
  /** Bấm số trang trong bản tóm tắt thì nhảy tới trang đó. */
  onSelectPage: (page: number) => void;
};

export function useSummaries({
  docId,
  scope,
  ai,
  ready,
  toc,
  currentSection,
  extractedPages,
  analysis,
  onSelectPage,
}: Input) {
  const aiSettings = ai.settings;
  const aiKey = ai.apiKey;
  const aiModel = ai.model;
  const setAiNotice = ai.setNotice;
  const [summaries, setSummaries] = useState<SummaryRecord[]>([]);
  // Mục đang được tóm tắt riêng lẻ (khoá `start-end`); chỉ mục đó hiện trạng thái chạy.
  const [summarizingKey, setSummarizingKey] = useState<string | null>(null);
  const [summaryProgress, setSummaryProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState<{ kind: LLMErrorKind; message: string } | null>(
    null,
  );
  // Bản tóm tắt vừa tạo trong phiên này; những bản còn lại là lấy từ cache.
  const [freshSummaryIds, setFreshSummaryIds] = useState<ReadonlySet<string>>(new Set());

  const [estimateDialog, setEstimateDialog] = useState<{
    open: boolean;
    estimate: WorkEstimate | null;
    sectionsCount: number;
    cachedCount: number;
    sections: TocItem[];
  } | null>(null);
  const [batchOutcome, setBatchOutcome] = useState<{
    failed: TocItem[];
    error: { kind: LLMErrorKind; message: string } | null;
  } | null>(null);
  const [batchLoadingProgress, setBatchLoadingProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const currentSectionNoText = useMemo(() => {
    if (!currentSection) return false;
    const pages = pagesInSpan(extractedPages, currentSection);
    if (pages.length === 0) {
      return analysis.phase === 'done';
    }
    return !pages.some((page) => page.text.trim().length > 0);
  }, [currentSection, extractedPages, analysis.phase]);

  const summaryConfig = useMemo<SummaryConfig>(
    () => ({ providerId: aiSettings.providerId, model: aiModel, language: aiSettings.language }),
    [aiSettings.providerId, aiModel, aiSettings.language],
  );

  // Chỉ bản tóm tắt khớp cấu hình hiện tại mới được tính là đã có (dấu ✦ và cache).
  const summarizedSpans = useMemo(() => {
    const spans = new Set<string>();
    for (const item of toc?.items ?? []) {
      if (findCachedSummary(summaries, item, summaryConfig, extractedPages)) {
        spans.add(`${item.startPage}-${item.endPage}`);
      }
    }
    return spans;
  }, [toc, summaries, summaryConfig, extractedPages]);

  const currentSummaryRecord = useMemo(
    () =>
      currentSection
        ? (findCachedSummary(summaries, currentSection, summaryConfig, extractedPages) ?? null)
        : null,
    [currentSection, summaries, summaryConfig, extractedPages],
  );
  const isFromCache =
    currentSummaryRecord !== null && !freshSummaryIds.has(currentSummaryRecord.id);
  const currentSectionKey = currentSection
    ? `${currentSection.startPage}-${currentSection.endPage}`
    : null;
  const summaryLoading = currentSectionKey !== null && summarizingKey === currentSectionKey;

  // Lỗi của một mục không theo sang mục khác.
  useEffect(() => {
    setSummaryError(null);
  }, [currentSectionKey, docId]);

  const doSummarizeCurrentSection = useCallback(async () => {
    if (!currentSection || !docId) return;
    const section = currentSection;
    const runDocId = docId;
    const generation = scope.generationRef.current;

    // `permissions.request` phải là lời gọi đầu tiên: Chrome chỉ chấp nhận trong thao tác của người dùng.
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (chromeApi?.permissions) {
      const origin = providerOriginPattern(aiSettings.providerId, aiSettings.baseUrl);
      const granted = await chromeApi.permissions.request({ origins: [origin] });
      if (scope.generationRef.current !== generation) return;
      if (!granted) {
        setSummaryError({ kind: 'network', message: vi.aiPermissionDenied });
        return;
      }
    }

    const pages = pagesInSpan(extractedPages, section);
    if (pages.length === 0 || !pages.some((page) => page.text.trim().length > 0)) {
      setSummaryError({ kind: 'bad-response', message: vi.summarizeNoText });
      return;
    }

    const abortCtrl = new AbortController();
    scope.summaryAbortRef.current?.abort();
    scope.summaryAbortRef.current = abortCtrl;
    const isActive = () =>
      scope.summaryAbortRef.current === abortCtrl && scope.generationRef.current === generation;
    setSummarizingKey(`${section.startPage}-${section.endPage}`);
    setSummaryProgress(null);
    setSummaryError(null);

    try {
      const provider = getProvider(aiSettings.providerId);
      const result = await summarizeSection({
        provider,
        config: { apiKey: aiKey.trim(), baseUrl: aiSettings.baseUrl },
        model: aiModel,
        kind: analysis.phase === 'done' ? analysis.profile.kind : 'unknown',
        title: section.title,
        pages,
        language: aiSettings.language,
        signal: abortCtrl.signal,
        onProgress: (done, total) => {
          if (isActive()) setSummaryProgress({ done, total });
        },
      });

      const language = sectionLanguage(aiSettings.language, pages);
      const record: SummaryRecord = {
        id: await summaryCacheKey({
          docId: runDocId,
          startPage: section.startPage,
          endPage: section.endPage,
          title: section.title,
          providerId: aiSettings.providerId,
          model: aiModel,
          promptVersion: PROMPT_VERSION,
          language: language,
        }),
        docId: runDocId,
        startPage: section.startPage,
        endPage: section.endPage,
        title: section.title,
        providerId: aiSettings.providerId,
        model: aiModel,
        promptVersion: PROMPT_VERSION,
        language,
        summary: result.summary,
        keyPoints: result.keyPoints,
        terms: result.terms,
        createdAt: Date.now(),
      };

      if (!isActive()) return;
      await saveSummary(record);
      if (!isActive()) return;
      // Bản mới hiện cho đúng mục đã yêu cầu; nếu người dùng đã sang mục khác thì chỉ vào danh sách.
      setSummaries((current) => [...current.filter((s) => s.id !== record.id), record]);
      setFreshSummaryIds((current) => new Set(current).add(record.id));
    } catch (error) {
      if (!isActive()) return;
      if (abortCtrl.signal.aborted) {
        setSummaryError({ kind: 'cancelled', message: vi.aiErrorMessages.cancelled });
      } else if (isLLMError(error)) {
        setSummaryError({ kind: error.kind, message: aiErrorMessage(error, aiSettings) });
      } else {
        setSummaryError({ kind: 'unknown', message: vi.aiErrorMessages.unknown });
      }
    } finally {
      if (scope.summaryAbortRef.current === abortCtrl) {
        scope.summaryAbortRef.current = null;
        setSummarizingKey(null);
        setSummaryProgress(null);
      }
    }
  }, [currentSection, docId, aiSettings, aiKey, aiModel, extractedPages, analysis]);

  const handleSummarizeCurrentSection = useCallback(() => {
    if (!currentSection || !docId) return;

    if (aiConfigProblem(aiSettings, aiKey) !== null) {
      setAiNotice({ tone: 'error', message: vi.aiMissingKey });
      return;
    }

    ai.ensureConsent(() => void doSummarizeCurrentSection());
  }, [currentSection, docId, aiSettings, aiKey, doSummarizeCurrentSection, ai.ensureConsent]);

  const handleCancelSummary = useCallback(() => {
    scope.summaryAbortRef.current?.abort();
  }, []);

  const handleRetrySummary = useCallback(() => {
    handleSummarizeCurrentSection();
  }, [handleSummarizeCurrentSection]);

  const handleSummarizeAllClick = useCallback(() => {
    if (!toc || !docId) return;
    if (aiConfigProblem(aiSettings, aiKey) !== null) {
      setAiNotice({ tone: 'error', message: vi.aiMissingKey });
      return;
    }
    setBatchOutcome(null);
    const plan = planSummarizeAll(toc.items, extractedPages, summaries, summaryConfig);
    if (plan.todo.length === 0) {
      setSummaryError({
        kind: 'bad-response',
        message: plan.cachedCount > 0 ? vi.summarizeAllNothingToDo : vi.summarizeAllNoText,
      });
      return;
    }
    setEstimateDialog({
      open: true,
      estimate: plan.estimate,
      sectionsCount: plan.todo.length,
      cachedCount: plan.cachedCount,
      sections: plan.todo,
    });
  }, [toc, docId, aiSettings, aiKey, extractedPages, summaries, summaryConfig]);

  const runSummarizeAll = useCallback(
    async (sections: TocItem[]) => {
      const runDocId = docId;
      if (!runDocId) return;
      const generation = scope.generationRef.current;

      // `permissions.request` phải là lời gọi đầu tiên (xem doSummarizeCurrentSection).
      const chromeApi = typeof chrome === 'undefined' ? null : chrome;
      if (chromeApi?.permissions) {
        const origin = providerOriginPattern(aiSettings.providerId, aiSettings.baseUrl);
        const granted = await chromeApi.permissions.request({ origins: [origin] });
        if (scope.generationRef.current !== generation) return;
        if (!granted) {
          setBatchOutcome({
            failed: [],
            error: { kind: 'network', message: vi.aiPermissionDenied },
          });
          return;
        }
      }

      const abortCtrl = new AbortController();
      scope.batchAbortRef.current?.abort();
      scope.batchAbortRef.current = abortCtrl;
      const isActive = () =>
        scope.batchAbortRef.current === abortCtrl && scope.generationRef.current === generation;
      setBatchOutcome(null);
      setBatchLoadingProgress({ done: 0, total: sections.length });
      let doneCount = 0;
      const provider = getProvider(aiSettings.providerId);
      const kind = analysis.phase === 'done' ? analysis.profile.kind : 'unknown';

      const result = await runSummaryBatch({
        items: sections,
        concurrency: 2,
        signal: abortCtrl.signal,
        worker: async (section, signal) => {
          const pages = pagesInSpan(extractedPages, section);
          const language = sectionLanguage(aiSettings.language, pages);
          const summary = await summarizeSection({
            provider,
            config: { apiKey: aiKey.trim(), baseUrl: aiSettings.baseUrl },
            model: aiModel,
            kind,
            title: section.title,
            pages,
            language: aiSettings.language,
            signal,
          });
          const record: SummaryRecord = {
            id: await summaryCacheKey({
              docId: runDocId,
              startPage: section.startPage,
              endPage: section.endPage,
              title: section.title,
              providerId: aiSettings.providerId,
              model: aiModel,
              promptVersion: PROMPT_VERSION,
              language: language,
            }),
            docId: runDocId,
            startPage: section.startPage,
            endPage: section.endPage,
            title: section.title,
            providerId: aiSettings.providerId,
            model: aiModel,
            promptVersion: PROMPT_VERSION,
            language,
            summary: summary.summary,
            keyPoints: summary.keyPoints,
            terms: summary.terms,
            createdAt: Date.now(),
          };
          signal.throwIfAborted();
          await saveSummary(record);
          if (!isActive()) return;
          doneCount += 1;
          setSummaries((current) => [...current.filter((s) => s.id !== record.id), record]);
          setFreshSummaryIds((current) => new Set(current).add(record.id));
          setBatchLoadingProgress({ done: doneCount, total: sections.length });
        },
      });

      if (!isActive()) return;
      scope.batchAbortRef.current = null;
      setBatchLoadingProgress(null);
      setBatchOutcome({
        failed: result.failed.map((entry) => entry.item),
        error:
          result.fatal === undefined
            ? null
            : isLLMError(result.fatal)
              ? { kind: result.fatal.kind, message: aiErrorMessage(result.fatal, aiSettings) }
              : { kind: 'unknown', message: vi.aiErrorMessages.unknown },
      });
    },
    [docId, aiSettings, aiKey, aiModel, analysis, extractedPages],
  );

  const handleConfirmSummarizeAll = useCallback(() => {
    if (!estimateDialog) return;
    const { sections } = estimateDialog;
    setEstimateDialog(null);

    ai.ensureConsent(() => void runSummarizeAll(sections));
  }, [estimateDialog, ai.ensureConsent, runSummarizeAll]);

  const handleCancelSummarizeAll = useCallback(() => {
    scope.batchAbortRef.current?.abort();
  }, []);

  const handleRetryFailedSections = useCallback(() => {
    if (!batchOutcome || batchOutcome.failed.length === 0) return;
    void runSummarizeAll(batchOutcome.failed);
  }, [batchOutcome, runSummarizeAll]);

  /** Nạp các bản tóm tắt đã lưu của tài liệu vừa mở (không có id thì rỗng). */
  const load = useCallback((hash: string | null) => {
    if (hash) {
      void loadSummariesForDoc(hash).then((records) => {
        setSummaries(records);
      });
    } else {
      setSummaries([]);
    }
  }, []);

  /** Bỏ các bản tóm tắt trong bộ nhớ của tài liệu đã đóng hoặc đã xoá. */
  const forget = useCallback(() => {
    setSummaries([]);
  }, []);

  /** Xoá trạng thái chạy của các lượt tóm tắt (mở file khác, đóng, xoá dữ liệu). */
  const clear = useCallback(() => {
    setSummarizingKey(null);
    setSummaryProgress(null);
    setSummaryError(null);
    setBatchLoadingProgress(null);
    setBatchOutcome(null);
    setEstimateDialog(null);
    setFreshSummaryIds(new Set());
  }, []);

  /** Phần dành cho tab Tóm tắt. */
  const panel = {
    configured: ai.configured,
    onOpenSettings: () => {},
    currentSection,
    summary: currentSummaryRecord,
    isCached: isFromCache,
    loading: summaryLoading,
    busyElsewhere: summarizingKey !== null && !summaryLoading,
    loadingProgress: summaryProgress,
    error: summaryError,
    noText: currentSectionNoText,
    onSummarize: handleSummarizeCurrentSection,
    onRegenerate: handleSummarizeCurrentSection,
    onCancel: handleCancelSummary,
    onRetry: handleRetrySummary,
    onSelectPage,
    canSummarizeAll: ready && toc !== null && toc.items.length > 0,
    summarizeAllProgress: batchLoadingProgress,
    onSummarizeAllClick: handleSummarizeAllClick,
    onCancelSummarizeAll: handleCancelSummarizeAll,
    summarizeAllOutcome: batchOutcome,
    onRetryFailed: handleRetryFailedSections,
    estimateDialog: estimateDialog
      ? {
          open: estimateDialog.open,
          estimate: estimateDialog.estimate,
          sectionsCount: estimateDialog.sectionsCount,
          cachedCount: estimateDialog.cachedCount,
          onConfirm: handleConfirmSummarizeAll,
          onCancel: () => setEstimateDialog(null),
        }
      : null,
  };

  return { records: summaries, summarizedSpans, panel, load, forget, clear };
}
