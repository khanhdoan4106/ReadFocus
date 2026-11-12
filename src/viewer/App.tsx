import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sha256Hex } from '../core/hash';
import { isLLMError } from '../core/llm/errors';
import { getProvider } from '../core/llm';
import { providerOriginPattern } from '../core/llm/permissions';
import { aiConfigProblem } from '../core/llm/settings';
import type { LLMErrorKind } from '../core/llm/types';
import type { TextPage } from '../core/summarize/chunk';
import { PROMPT_VERSION } from '../core/summarize/prompt';
import { summaryCacheKey } from '../core/summarize/cache-key';
import { runSummaryBatch } from '../core/summarize/batch';
import {
  findCachedSummary,
  planSummarizeAll,
  sectionLanguage,
  type SummaryConfig,
} from '../core/summarize/plan';
import { summarizeSection } from '../core/summarize/run';
import { pagesInSpan, type WorkEstimate } from '../core/summarize/work';
import type { SummaryRecord } from '../core/summarize/record';
import { buildOcrOptions } from '../core/ocr/options';
import {
  buildOcrPageRecords,
  hasTextLayer,
  isLowConfidence,
  pagesToRecognize,
  unionIndexRange,
  type PageRange,
} from '../core/ocr/pages';
import { runOcr, withOcrEngine } from '../core/ocr/run';
import type { OcrPageView } from '../core/ocr/types';
import { clampPage, fitWidthScale, stepZoom } from '../core/pagination';
import { fileNameFromUrl, isFileUrl } from '../core/pdf-url';
import { readRequestedPdfUrl } from '../core/pdf-redirect';
import { buildProfile, type DocumentProfile, type PageSample } from '../core/profile';
import { acceptPageReport, canPersistProgress } from '../core/progress';
import { addReadingSample, chapterEstimate, MAX_ACTIVE_GAP_MS } from '../core/reading-time';
import { buildSearchIndex, type SearchIndex } from '../core/search';
import { countWords } from '../core/text';
import { buildToc, type TocPage, type TocResult } from '../core/toc';
import { clampBandHeight, clampMinutes, formatTimer } from '../core/focus';
import { emptyDayStats, type DayStats } from '../core/stats';
import { vi } from '../i18n/vi';
import {
  addDailyReading,
  clearAllData,
  clearPageTexts,
  loadOcrPages,
  deleteDocumentData,
  loadDayStats,
  loadProgress,
  loadRecentStats,
  loadSummariesForDoc,
  recordDocumentOpen,
  savePageTexts,
  saveProgress,
  saveSummary,
  type TocItem,
} from '../storage/db';
import { extractRange, INDEX_PAGE_LIMIT, readOutline } from './extract';
import { OcrPanel, type OcrReport } from './OcrPanel';
import { PageList, type PageSize } from './PageList';
import { readTextLayers, renderPageForOcr } from './ocr';
import { openPdfData, readPdfFile } from './pdf';
import { aiErrorMessage } from './ai-errors';
import { Dialog } from './Dialog';
import { useAsk } from './ask';
import { useFlashcards } from './flashcards';
import { useSemanticIndex } from './semantic';
import { useAiSettings } from './hooks/useAiSettings';
import { useFocusTimer } from './hooks/useFocusTimer';
import { useSettings } from './hooks/useSettings';
import { Sidebar } from './Sidebar';

import { errorMessage, profileLabel, timerModeLabel, type ErrorReason } from './labels';

type Status = 'empty' | 'opening' | 'ready' | 'error';
type Analysis =
  | { phase: 'idle' }
  | { phase: 'extracting'; done: number; total: number }
  | { phase: 'done'; profile: DocumentProfile }
  | { phase: 'error' };

type IndexRange = {
  from: string;
  to: string;
};

const FALLBACK_PAGE_SIZE: PageSize = { width: 612, height: 792 };

async function hashData(data: ArrayBuffer): Promise<string | null> {
  try {
    return await sha256Hex(data);
  } catch {
    // Không băm được vẫn phải cho đọc, chỉ là không lưu/khôi phục tiến độ.
    return null;
  }
}

export function App() {
  const [status, setStatus] = useState<Status>('empty');
  const [error, setError] = useState<ErrorReason>('unknown');
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageDraft, setPageDraft] = useState('1');
  const [scale, setScale] = useState(1);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>({ phase: 'idle' });
  const [indexRange, setIndexRange] = useState<IndexRange | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocResult | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [pageWords, setPageWords] = useState<Record<number, number>>({});
  const [highlight, setHighlight] = useState<{
    page: number;
    query: string;
    ignoreDiacritics: boolean;
    quote?: boolean;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [todayStats, setTodayStats] = useState<DayStats>(() => emptyDayStats());
  const [recentStats, setRecentStats] = useState<DayStats[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const settings = useSettings({ showToast: setToast });
  const readingWordsPerMinute = settings.wordsPerMinute;
  const setSpeed = settings.setSpeed;
  const ai = useAiSettings();
  const aiSettings = ai.settings;
  const aiKey = ai.apiKey;
  const aiSupported = ai.supported;
  const aiModel = ai.model;
  const setAiNotice = ai.setNotice;
  const [searchRequest, setSearchRequest] = useState(0);

  const [extractedPages, setExtractedPages] = useState<TextPage[]>([]);
  // Trang đã nhận dạng bằng OCR (kèm hộp bao từ) để tô kết quả tìm kiếm.
  const [ocrPages, setOcrPages] = useState<ReadonlyMap<number, OcrPageView>>(new Map());
  const [ocrProgress, setOcrProgress] = useState<{ done: number; total: number } | null>(null);
  const [ocrReport, setOcrReport] = useState<OcrReport | null>(null);
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
  const summaryAbortRef = useRef<AbortController | null>(null);

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
  const batchAbortRef = useRef<AbortController | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  // Văn bản OCR đã lưu, dùng thay cho lớp chữ trống khi lập chỉ mục.
  const ocrTextRef = useRef<Map<number, string>>(new Map());
  // Khoảng trang đã lập chỉ mục gần nhất, để lập lại sau OCR.
  const indexedRangeRef = useRef<PageRange | null>(null);
  // Tăng mỗi khi mở hoặc đóng tài liệu để bỏ kết quả của lượt tóm tắt cũ.
  const summaryGenerationRef = useRef(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const closeRef = useRef<(() => Promise<void>) | null>(null);
  const pageNumberRef = useRef(pageNumber);
  pageNumberRef.current = pageNumber;
  // Trang đích trong lúc chờ nhảy tới tiến độ đã lưu; `null` khi không khôi phục.
  const restoringRef = useRef<number | null>(null);
  // Mỗi lần mở tài liệu hoặc lập chỉ mục lại thì tăng lên để dừng lượt trích cũ.
  const analysisTokenRef = useRef(0);
  // Đồng hồ đọc: thời gian đang đọc trang hiện tại, chỉ cộng khi tab hiển thị.
  const clockRef = useRef<{ page: number; activeMs: number; lastTick: number | null }>({
    page: 1,
    activeMs: 0,
    lastTick: null,
  });

  /** Dừng mọi lượt tóm tắt và xoá trạng thái của chúng (mở file khác, đóng, xoá dữ liệu). */
  const resetBackgroundRuns = useCallback(() => {
    summaryGenerationRef.current += 1;
    summaryAbortRef.current?.abort();
    batchAbortRef.current?.abort();
    ocrAbortRef.current?.abort();
    summaryAbortRef.current = null;
    batchAbortRef.current = null;
    ocrAbortRef.current = null;
    setOcrProgress(null);
    setOcrReport(null);
    setSummarizingKey(null);
    setSummaryProgress(null);
    setSummaryError(null);
    setBatchLoadingProgress(null);
    setBatchOutcome(null);
    setEstimateDialog(null);
    setFreshSummaryIds(new Set());
  }, []);

  // Đóng viewer: huỷ request và dừng worker OCR còn đang chạy.
  useEffect(
    () => () => {
      summaryAbortRef.current?.abort();
      batchAbortRef.current?.abort();
      ocrAbortRef.current?.abort();
    },
    [],
  );
  // Số phút/trang đã đọc chờ ghi vào thống kê ngày.
  const statsPendingRef = useRef({ minutes: 0, pages: 0 });

  useEffect(() => {
    return () => {
      analysisTokenRef.current += 1;
      void closeRef.current?.();
      closeRef.current = null;
      docRef.current = null;
    };
  }, []);

  useEffect(() => {
    setPageDraft(String(pageNumber));
  }, [pageNumber]);

  const scrollToPage = useCallback((page: number) => {
    const scroller = contentRef.current;
    const slot = scroller?.querySelector<HTMLElement>(`.page-slot[data-page="${page}"]`);
    if (scroller && slot) {
      scroller.scrollTo({ top: Math.max(slot.offsetTop - 8, 0) });
    }
  }, []);

  const runExtraction = useCallback(
    async (pdfDoc: PDFDocumentProxy, from: number, to: number, id: string | null) => {
      const token = analysisTokenRef.current + 1;
      analysisTokenRef.current = token;
      const total = to - from + 1;
      setRangeError(null);
      setAnalysis({ phase: 'extracting', done: 0, total });

      if (id) void clearPageTexts(id);
      indexedRangeRef.current = { from, to };

      const pending: { page: number; text: string }[] = [];
      const flush = () => {
        if (!id || pending.length === 0) return;
        void savePageTexts(id, pending.splice(0, pending.length));
      };

      try {
        const outline = await readOutline(pdfDoc);
        const outlineDepth = outline.reduce((max, entry) => Math.max(max, entry.level), 0);
        const samples: PageSample[] = [];
        const tocPages: TocPage[] = [];

        await extractRange(pdfDoc, {
          from,
          to,
          shouldStop: () => analysisTokenRef.current !== token,
          onPage: (extracted) => {
            // Trang scan đã OCR: dùng chữ OCR (đã lưu riêng, không ghi đè bản ghi OCR).
            const ocrText = ocrTextRef.current.get(extracted.page);
            const useOcr = ocrText !== undefined && !hasTextLayer(extracted);
            const page = useOcr ? { ...extracted, text: ocrText, lines: [] } : extracted;
            samples.push(page);
            tocPages.push({
              page: page.page,
              text: page.text,
              lines: page.lines,
              width: page.width,
              height: page.height,
            });
            if (!useOcr) pending.push({ page: page.page, text: page.text });
            if (pending.length >= 10) flush();
            if (analysisTokenRef.current === token) {
              setAnalysis({ phase: 'extracting', done: samples.length, total });
            }
          },
        });
        flush();

        if (analysisTokenRef.current !== token) return;
        const profile = buildProfile(samples, { outlineDepth });
        setAnalysis({ phase: 'done', profile });
        setToc(
          buildToc({
            pages: tocPages,
            outline,
            pageCount: pdfDoc.numPages,
            kind: profile.kind,
          }),
        );
        setSearchIndex(
          buildSearchIndex(tocPages.map((page) => ({ page: page.page, text: page.text }))),
        );
        setPageWords(
          Object.fromEntries(tocPages.map((page) => [page.page, countWords(page.text)])),
        );
        setExtractedPages(tocPages.map((page) => ({ page: page.page, text: page.text })));
      } catch {
        flush();
        if (analysisTokenRef.current === token) setAnalysis({ phase: 'error' });
      }
    },
    [],
  );

  /** Tài liệu dài chưa trích văn bản vẫn hiện được outline ngay. */
  const loadOutlineToc = useCallback(async (pdfDoc: PDFDocumentProxy, token: number) => {
    const outline = await readOutline(pdfDoc);
    if (analysisTokenRef.current !== token || outline.length === 0) return;
    setToc(buildToc({ pages: [], outline, pageCount: pdfDoc.numPages }));
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      const target = clampPage(next, docRef.current?.numPages ?? 1);
      setPageNumber(target);
      scrollToPage(target);
    },
    [scrollToPage],
  );

  const handleStartOcr = useCallback(
    async (range: PageRange) => {
      const pdfDoc = docRef.current;
      const runDocId = docId;
      if (!pdfDoc || !runDocId || ocrAbortRef.current) return;

      const getUrl = typeof chrome !== 'undefined' ? chrome.runtime?.getURL : undefined;
      if (!getUrl) {
        setOcrReport({
          recognized: 0,
          nothingToDo: false,
          cancelled: false,
          failedPages: [],
          lowConfidencePages: [],
          error: vi.ocrEngineError,
        });
        return;
      }

      const generation = summaryGenerationRef.current;
      // Giữ đúng bản đồ của tài liệu đang OCR, không ghi nhầm sang tài liệu khác.
      const ocrText = ocrTextRef.current;
      const abort = new AbortController();
      ocrAbortRef.current = abort;
      const isActive = () =>
        ocrAbortRef.current === abort && summaryGenerationRef.current === generation;
      const report: OcrReport = {
        recognized: 0,
        nothingToDo: false,
        cancelled: false,
        failedPages: [],
        lowConfidencePages: [],
        error: null,
      };
      setOcrReport(null);
      setOcrProgress({ done: 0, total: range.to - range.from + 1 });

      try {
        const layers = await readTextLayers(pdfDoc, range);
        if (!isActive()) return;
        const todo = pagesToRecognize(range, layers).filter((page) => !ocrText.has(page));
        if (todo.length === 0) {
          report.nothingToDo = true;
          return;
        }
        setOcrProgress({ done: 0, total: todo.length });

        const { createTesseractEngine } = await import('../core/ocr/tesseract-engine');
        const options = buildOcrOptions((path) => getUrl.call(chrome.runtime, path));
        const outcome = await withOcrEngine(
          () => createTesseractEngine(options),
          (engine) =>
            runOcr({
              engine,
              pages: todo,
              signal: abort.signal,
              renderPage: (page, signal) => renderPageForOcr(pdfDoc, page, signal),
              onProgress: (progress) => {
                if (isActive()) setOcrProgress({ done: progress.done, total: progress.total });
              },
              onPage: async (page, result) => {
                const [record] = buildOcrPageRecords(new Map([[page, result]]));
                if (!record) return;
                await savePageTexts(runDocId, [record]);
                if (!isActive()) return;
                report.recognized += 1;
                if (isLowConfidence(record.confidence)) report.lowConfidencePages.push(page);
                ocrText.set(page, record.text);
                setOcrPages((current) =>
                  new Map(current).set(page, { confidence: record.confidence, ...record.ocr }),
                );
              },
            }),
        );
        report.failedPages = outcome.failed;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          report.cancelled = true;
        } else {
          report.error = vi.ocrEngineError;
        }
      } finally {
        if (isActive()) {
          ocrAbortRef.current = null;
          setOcrProgress(null);
          setOcrReport(report);
          // Trang vừa nhận dạng có chữ: lập lại phân loại, mục lục, chỉ mục và thời gian đọc.
          if (report.recognized > 0) {
            const next = unionIndexRange(indexedRangeRef.current, range);
            void runExtraction(pdfDoc, next.from, next.to, runDocId);
          }
        }
      }
    },
    [docId, runExtraction],
  );

  const handleCancelOcr = useCallback(() => {
    ocrAbortRef.current?.abort();
  }, []);

  const handleSearchResult = useCallback(
    (page: number, query: string, ignoreDiacritics: boolean) => {
      goToPage(page);
      setHighlight({ page, query, ignoreDiacritics });
    },
    [goToPage],
  );

  const handleCitation = useCallback(
    (page: number, quote: string) => {
      goToPage(page);
      setHighlight({ page, query: quote, ignoreDiacritics: true, quote: true });
    },
    [goToPage],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setStatus('opening');
      const read = await readPdfFile(file);

      if (!read.ok) {
        setError(read.reason);
        setStatus('error');
        return;
      }

      const [result, hash] = await Promise.all([openPdfData(read.data), hashData(read.data)]);

      if (!result.ok) {
        setError(result.reason);
        setStatus('error');
        return;
      }

      // Dừng OCR/tóm tắt của tài liệu cũ trước mọi bước await tiếp theo, để kết quả về
      // muộn không lẫn vào tài liệu mới.
      resetBackgroundRuns();
      await closeRef.current?.();
      docRef.current = result.doc;
      closeRef.current = result.close;

      const savedOcr = hash ? await loadOcrPages(hash) : [];
      ocrTextRef.current = new Map(savedOcr.map((page) => [page.page, page.text]));
      setOcrPages(
        new Map(
          savedOcr.flatMap((page) =>
            page.ocr
              ? [[page.page, { confidence: page.confidence ?? 0, ...page.ocr }] as const]
              : [],
          ),
        ),
      );

      const baseViewport = (await result.doc.getPage(1)).getViewport({ scale: 1 });
      const availableWidth = (contentRef.current?.clientWidth ?? 0) - 48;
      const stored = hash ? await loadProgress(hash, result.doc.numPages) : null;
      const resumePage = stored?.page ?? 1;

      // Chặn báo cáo trang và ghi tiến độ cho tới khi cuộn xong tới trang khôi phục.
      restoringRef.current = resumePage > 1 ? resumePage : null;

      setDoc(result.doc);
      setDocId(hash);
      setFileName(file.name);
      setPageNumber(resumePage);
      setPageDraft(String(resumePage));
      setPageSizes({ 1: { width: baseViewport.width, height: baseViewport.height } });
      setScale(availableWidth > 0 ? fitWidthScale(baseViewport.width, availableWidth) : 1);
      setStatus('ready');

      // Tài liệu mới: bỏ mẫu đọc của tài liệu trước, bắt đầu đo từ trang khôi phục.
      clockRef.current = {
        page: resumePage,
        activeMs: 0,
        lastTick: document.visibilityState === 'visible' ? Date.now() : null,
      };
      setPageWords({});

      if (hash) {
        void recordDocumentOpen({
          id: hash,
          name: file.name,
          size: file.size,
          pageCount: result.doc.numPages,
        });
        void loadSummariesForDoc(hash).then((records) => {
          setSummaries(records);
        });
      } else {
        setSummaries([]);
      }
      setExtractedPages([]);
      resetBackgroundRuns();

      analysisTokenRef.current += 1;
      const token = analysisTokenRef.current;
      setToc(null);
      setSearchIndex(null);
      setHighlight(null);
      setIndexRange(null);
      setRangeError(null);
      setAnalysis({ phase: 'idle' });

      if (result.doc.numPages > INDEX_PAGE_LIMIT) {
        setIndexRange({ from: '1', to: String(INDEX_PAGE_LIMIT) });
        void loadOutlineToc(result.doc, token);
      } else {
        void runExtraction(result.doc, 1, result.doc.numPages, hash);
      }

      if (resumePage > 1) {
        setTimeout(() => {
          scrollToPage(resumePage);
          setPageNumber(resumePage);
          restoringRef.current = null;
        }, 0);
      }
    },
    [loadOutlineToc, runExtraction, scrollToPage],
  );

  const openFromUrl = useCallback(
    async (url: string) => {
      if (isFileUrl(url)) {
        setError('file-url');
        setStatus('error');
        return;
      }

      setStatus('opening');
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], fileNameFromUrl(url), {
          type: blob.type || 'application/pdf',
        });
        await handleFile(file);
      } catch {
        setError('fetch');
        setStatus('error');
      }
    },
    [handleFile],
  );

  // Mở PDF do context menu hoặc nút toolbar trên trang PDF đưa sang.
  useEffect(() => {
    const requested = readRequestedPdfUrl(window.location.search);
    if (requested === null) return;
    void openFromUrl(requested);
  }, [openFromUrl]);

  const handleMeasured = useCallback((page: number, size: PageSize) => {
    setPageSizes((previous) => {
      const existing = previous[page];
      if (
        existing &&
        Math.abs(existing.width - size.width) < 0.5 &&
        Math.abs(existing.height - size.height) < 0.5
      ) {
        return previous;
      }
      return { ...previous, [page]: size };
    });
  }, []);

  const handleRenderError = useCallback(() => {
    setError('render');
    setStatus('error');
  }, []);

  const handleCurrentPageChange = useCallback((page: number) => {
    const accepted = acceptPageReport(page, restoringRef.current);
    if (accepted !== null) setPageNumber(accepted);
  }, []);

  // Ghi tiến độ sau khi người dùng dừng cuộn một nhịp, tránh ghi IndexedDB liên tục.
  useEffect(() => {
    if (status !== 'ready' || !docId) return;
    const timer = setTimeout(() => {
      if (!canPersistProgress(restoringRef.current)) return;
      void saveProgress(docId, pageNumber);
    }, 400);
    return () => clearTimeout(timer);
  }, [docId, pageNumber, status]);

  const currentSection = useMemo(() => {
    if (!toc || toc.items.length === 0) return null;
    return (
      toc.items.find((item) => pageNumber >= item.startPage && pageNumber <= item.endPage) ?? null
    );
  }, [toc, pageNumber]);

  const currentSectionNoText = useMemo(() => {
    if (!currentSection) return false;
    const pages = pagesInSpan(extractedPages, currentSection);
    if (pages.length === 0) {
      return analysis.phase === 'done';
    }
    return !pages.some((page) => page.text.trim().length > 0);
  }, [currentSection, extractedPages, analysis.phase]);

  const ensureAskConsent = ai.ensureConsent;
  const semantic = useSemanticIndex({
    docId,
    pages: extractedPages,
    settings: aiSettings,
    apiKey: aiKey,
  });
  const ask = useAsk({
    docId,
    pages: extractedPages,
    index: searchIndex,
    semantic,
    settings: aiSettings,
    apiKey: aiKey,
    ensureConsent: ensureAskConsent,
  });
  const flashcards = useFlashcards({
    docId,
    summaries,
    section: currentSection,
    pages: extractedPages,
    settings: aiSettings,
    apiKey: aiKey,
    ensureConsent: ensureAskConsent,
  });
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
    const generation = summaryGenerationRef.current;

    // `permissions.request` phải là lời gọi đầu tiên: Chrome chỉ chấp nhận trong thao tác của người dùng.
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (chromeApi?.permissions) {
      const origin = providerOriginPattern(aiSettings.providerId, aiSettings.baseUrl);
      const granted = await chromeApi.permissions.request({ origins: [origin] });
      if (summaryGenerationRef.current !== generation) return;
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
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = abortCtrl;
    const isActive = () =>
      summaryAbortRef.current === abortCtrl && summaryGenerationRef.current === generation;
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
      if (summaryAbortRef.current === abortCtrl) {
        summaryAbortRef.current = null;
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
    summaryAbortRef.current?.abort();
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
      const generation = summaryGenerationRef.current;

      // `permissions.request` phải là lời gọi đầu tiên (xem doSummarizeCurrentSection).
      const chromeApi = typeof chrome === 'undefined' ? null : chrome;
      if (chromeApi?.permissions) {
        const origin = providerOriginPattern(aiSettings.providerId, aiSettings.baseUrl);
        const granted = await chromeApi.permissions.request({ origins: [origin] });
        if (summaryGenerationRef.current !== generation) return;
        if (!granted) {
          setBatchOutcome({
            failed: [],
            error: { kind: 'network', message: vi.aiPermissionDenied },
          });
          return;
        }
      }

      const abortCtrl = new AbortController();
      batchAbortRef.current?.abort();
      batchAbortRef.current = abortCtrl;
      const isActive = () =>
        batchAbortRef.current === abortCtrl && summaryGenerationRef.current === generation;
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
      batchAbortRef.current = null;
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
    batchAbortRef.current?.abort();
  }, []);

  const handleRetryFailedSections = useCallback(() => {
    if (!batchOutcome || batchOutcome.failed.length === 0) return;
    void runSummarizeAll(batchOutcome.failed);
  }, [batchOutcome, runSummarizeAll]);

  const refreshStats = useCallback(async () => {
    const [today, recent] = await Promise.all([loadDayStats(), loadRecentStats(7)]);
    setTodayStats(today);
    setRecentStats(recent);
  }, []);

  const flushStats = useCallback(async () => {
    const pending = statsPendingRef.current;
    if (pending.minutes < 0.01 && pending.pages === 0) return;
    statsPendingRef.current = { minutes: 0, pages: 0 };
    const today = await addDailyReading(pending.minutes, pending.pages);
    setTodayStats(today);
    setRecentStats(await loadRecentStats(7));
  }, []);

  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  /** Đóng tài liệu đang mở và xoá trạng thái phân tích trong bộ nhớ. */
  const resetDocument = useCallback(async () => {
    analysisTokenRef.current += 1;
    await closeRef.current?.();
    closeRef.current = null;
    docRef.current = null;
    restoringRef.current = null;
    setDoc(null);
    setDocId(null);
    setFileName('');
    setStatus('empty');
    setToc(null);
    setSearchIndex(null);
    setAnalysis({ phase: 'idle' });
    setPageWords({});
    setHighlight(null);
    setIndexRange(null);
    setRangeError(null);
    setSummaries([]);
    setExtractedPages([]);
    ocrTextRef.current = new Map();
    setOcrPages(new Map());
    resetBackgroundRuns();
  }, [resetBackgroundRuns]);

  const handleDeleteDocument = useCallback(async () => {
    if (docId === null) return;
    if (!window.confirm(vi.deleteDocumentConfirm(fileName))) return;

    const ok = await deleteDocumentData(docId);
    if (!ok) {
      setToast(vi.deleteFailed);
      return;
    }

    // Dừng lượt trích đang chạy và bỏ chỉ mục của tài liệu vừa xoá.
    analysisTokenRef.current += 1;
    setDocId(null);
    setToc(null);
    setSearchIndex(null);
    setAnalysis({ phase: 'idle' });
    setPageWords({});
    setSummaries([]);
    setExtractedPages([]);
    ocrTextRef.current = new Map();
    setOcrPages(new Map());
    resetBackgroundRuns();
    setToast(vi.deleteDocumentDone);
  }, [docId, fileName, resetBackgroundRuns]);

  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm(vi.deleteAllConfirm)) return;

    const ok = await clearAllData();
    if (!ok) {
      setToast(vi.deleteFailed);
      return;
    }

    await resetDocument();
    statsPendingRef.current = { minutes: 0, pages: 0 };
    setTodayStats(emptyDayStats());
    setRecentStats([]);
    setToast(vi.deleteAllDone);
  }, [resetDocument]);

  // Ghi thống kê định kỳ thay vì mỗi giây.
  useEffect(() => {
    if (status !== 'ready') return;
    const id = setInterval(() => void flushStats(), 30_000);
    return () => {
      clearInterval(id);
      void flushStats();
    };
  }, [status, flushStats]);

  // Đồng hồ chỉ chạy khi tab hiển thị; khoảng nghỉ dài hơn 2 phút không được tính.
  useEffect(() => {
    if (status !== 'ready') return;
    const clock = clockRef.current;

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible') {
        clock.lastTick = null;
        return;
      }
      if (clock.lastTick === null) {
        clock.lastTick = now;
        return;
      }
      const delta = Math.min(Math.max(now - clock.lastTick, 0), MAX_ACTIVE_GAP_MS);
      clock.activeMs += delta;
      statsPendingRef.current.minutes += delta / 60_000;
      clock.lastTick = now;
    };

    const onVisibilityChange = () => {
      clock.lastTick = null;
      tick();
      if (document.visibilityState !== 'visible') void flushStats();
    };

    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    tick();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clock.lastTick = null;
    };
  }, [flushStats, status]);

  // Rời trang thì chốt mẫu đọc của trang vừa xem để học tốc độ thực tế.
  useEffect(() => {
    const clock = clockRef.current;
    if (clock.page === pageNumber) return;

    const words = pageWords[clock.page] ?? 0;
    if (words > 0 && clock.activeMs > 0) {
      setSpeed((current) => addReadingSample(current, { words, activeMs: clock.activeMs }));
    }
    if (clock.activeMs >= 1000) statsPendingRef.current.pages += 1;

    clock.page = pageNumber;
    clock.activeMs = 0;
    clock.lastTick = document.visibilityState === 'visible' ? Date.now() : null;
  }, [pageNumber, pageWords]);

  const chapterMinutes = chapterEstimate(toc, pageNumber, readingWordsPerMinute);
  const {
    timer,
    remainingMs: remainingTimerMs,
    focusMinutes,
    breakMinutes,
    bandHeight,
    bandTop,
    focusMode,
    fullscreen,
    setFocusMinutes,
    setBreakMinutes,
    setBandHeight,
    startChapterTimer,
    startPomodoroTimer,
    toggleTimer,
    stopTimer: stopCurrentTimer,
    toggleFocusMode,
    toggleFullscreen,
    moveBand,
  } = useFocusTimer({ showToast: setToast, chapterMinutes });
  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);
  const previousScaleRef = useRef(scale);
  const anchorPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (previousScaleRef.current === scale) return;
    previousScaleRef.current = scale;
    const target = anchorPageRef.current ?? pageNumberRef.current;
    anchorPageRef.current = null;
    const timer = setTimeout(() => {
      scrollToPage(target);
      setPageNumber(target);
    }, 0);
    return () => clearTimeout(timer);
  }, [scale, scrollToPage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (docRef.current === null || status !== 'ready') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      // Hộp thoại đang mở: phím tắt của viewer không được chạy phía sau nó.
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (focusMode) {
        if (event.key === 'Escape') {
          event.preventDefault();
          toggleFocusMode();
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const delta = event.key === 'ArrowUp' ? -32 : 32;
          moveBand(delta);
          return;
        }
      }

      if (event.key === '/') {
        event.preventDefault();
        if (focusMode) toggleFocusMode();
        setSidebarOpen(true);
        setSearchRequest((value) => value + 1);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFocusMode();
      } else if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      } else if (event.key === ' ') {
        // Để nút đang có focus tự xử lý Space, tránh vừa bấm nút vừa đổi hẹn giờ.
        if (target?.tagName === 'BUTTON' || target?.tagName === 'A') return;
        event.preventDefault();
        toggleTimer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToPage(pageNumberRef.current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPage(pageNumberRef.current - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, goToPage, status, toggleFocusMode, toggleTimer]);

  const handleZoom = (direction: 1 | -1) => {
    anchorPageRef.current = pageNumberRef.current;
    setScale((current) => stepZoom(current, direction));
  };

  const handleFitWidth = () => {
    if (!doc) return;
    const baseSize = pageSizes[pageNumberRef.current] ?? pageSizes[1] ?? FALLBACK_PAGE_SIZE;
    const availableWidth = (contentRef.current?.clientWidth ?? 0) - 48;
    if (availableWidth > 0) {
      anchorPageRef.current = pageNumberRef.current;
      setScale(fitWidthScale(baseSize.width, availableWidth));
    }
  };

  const commitPageDraft = () => {
    const parsed = Number.parseInt(pageDraft, 10);
    if (Number.isNaN(parsed)) {
      setPageDraft(String(pageNumber));
      return;
    }
    goToPage(parsed);
  };

  const startIndexing = () => {
    if (!doc || !indexRange) return;

    const from = Number.parseInt(indexRange.from, 10);
    const to = Number.parseInt(indexRange.to, 10);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to < from ||
      to > doc.numPages
    ) {
      setRangeError(vi.indexRangeInvalid);
      return;
    }
    if (to - from + 1 > INDEX_PAGE_LIMIT) {
      setRangeError(vi.indexRangeTooLong(INDEX_PAGE_LIMIT));
      return;
    }

    setIndexRange(null);
    void runExtraction(doc, from, to, docId);
  };

  const totalPages = doc?.numPages ?? 0;
  // Có trang chưa có lớp chữ (bản scan) hoặc đã từng OCR thì cho nhận dạng chữ.
  const showOcrPanel =
    status === 'ready' &&
    analysis.phase === 'done' &&
    (analysis.profile.isScanned ||
      ocrPages.size > 0 ||
      extractedPages.some((page) => page.text.trim() === ''));
  const fallbackSize = pageSizes[1] ?? FALLBACK_PAGE_SIZE;
  const showNotice =
    status === 'ready' &&
    (indexRange !== null ||
      analysis.phase === 'extracting' ||
      analysis.phase === 'error' ||
      (analysis.phase === 'done' && analysis.profile.isScanned) ||
      showOcrPanel ||
      ocrProgress !== null);

  return (
    <div
      class="app"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer?.files[0];
        if (file) void handleFile(file);
      }}
    >
      <header class="toolbar" role="group" aria-label="Điều khiển tài liệu">
        <button
          type="button"
          class="toolbar__button toolbar__button--primary"
          onClick={() => inputRef.current?.click()}
        >
          {vi.openFile}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void handleFile(file);
            event.currentTarget.value = '';
          }}
        />

        <span class="toolbar__name" title={fileName}>
          {fileName || vi.fileNameUnknown}
        </span>

        {status === 'ready' && analysis.phase === 'done' && (
          <span class="toolbar__profile">{profileLabel(analysis.profile.kind)}</span>
        )}

        {timer.status !== 'idle' && (
          <button
            type="button"
            class={`toolbar__button toolbar__timer${
              timer.status === 'paused' ? ' toolbar__timer--paused' : ''
            }`}
            aria-label={vi.timerToggleAria(
              timerModeLabel(timer.mode),
              formatTimer(remainingTimerMs),
            )}
            onClick={toggleTimer}
          >
            <span class="toolbar__timer-mode">{timerModeLabel(timer.mode)}</span>
            <span class="toolbar__timer-time">{formatTimer(remainingTimerMs)}</span>
          </button>
        )}

        <div class="toolbar__group">
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.previousPage}
            disabled={status !== 'ready' || pageNumber <= 1}
            onClick={() => goToPage(pageNumberRef.current - 1)}
          >
            ←
          </button>
          <input
            class="toolbar__page"
            type="number"
            min={1}
            max={totalPages}
            aria-label={vi.pageInputLabel}
            value={pageDraft}
            disabled={status !== 'ready'}
            onInput={(event) => setPageDraft(event.currentTarget.value)}
            onBlur={commitPageDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitPageDraft();
            }}
          />
          <span class="toolbar__total">{vi.pageLabel(pageNumber, Math.max(totalPages, 1))}</span>
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.nextPage}
            disabled={status !== 'ready' || pageNumber >= totalPages}
            onClick={() => goToPage(pageNumberRef.current + 1)}
          >
            →
          </button>
        </div>

        <div class="toolbar__group">
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.zoomOut}
            disabled={status !== 'ready'}
            onClick={() => handleZoom(-1)}
          >
            −
          </button>
          <span class="toolbar__zoom">{vi.zoomLabel(Math.round(scale * 100))}</span>
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.zoomIn}
            disabled={status !== 'ready'}
            onClick={() => handleZoom(1)}
          >
            +
          </button>
          <button
            type="button"
            class="toolbar__button"
            disabled={status !== 'ready'}
            onClick={handleFitWidth}
          >
            {vi.zoomFitWidth}
          </button>
        </div>

        <button
          type="button"
          class="toolbar__button"
          aria-label={vi.tocTitle}
          aria-expanded={sidebarOpen}
          aria-controls="viewer-sidebar"
          disabled={status !== 'ready'}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {vi.tocTitle}
        </button>
      </header>

      {showNotice && (
        <section class="notice" aria-live="polite">
          {indexRange && (
            <form
              class="notice__form"
              onSubmit={(event) => {
                event.preventDefault();
                startIndexing();
              }}
            >
              <p class="notice__text">{vi.longDocWarning(INDEX_PAGE_LIMIT)}</p>
              <label class="notice__field">
                {vi.indexFrom}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={indexRange.from}
                  onInput={(event) =>
                    setIndexRange({ ...indexRange, from: event.currentTarget.value })
                  }
                />
              </label>
              <label class="notice__field">
                {vi.indexTo}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={indexRange.to}
                  onInput={(event) =>
                    setIndexRange({ ...indexRange, to: event.currentTarget.value })
                  }
                />
              </label>
              <button type="submit" class="notice__button">
                {vi.indexStart}
              </button>
              {rangeError && (
                <p class="notice__error" role="alert">
                  {rangeError}
                </p>
              )}
            </form>
          )}

          {analysis.phase === 'extracting' && (
            <div class="notice__progress">
              <progress value={analysis.done} max={analysis.total} />
              <span>{vi.extracting(analysis.done, analysis.total)}</span>
            </div>
          )}

          {analysis.phase === 'done' && analysis.profile.isScanned && (
            <p class="notice__text notice__text--warning">{vi.scannedWarning}</p>
          )}

          {(showOcrPanel || ocrProgress !== null) && (
            <OcrPanel
              currentPage={pageNumber}
              pageCount={totalPages}
              running={ocrProgress}
              report={ocrReport}
              hasOcrPages={ocrPages.size > 0}
              onStart={(range) => void handleStartOcr(range)}
              onCancel={handleCancelOcr}
            />
          )}

          {analysis.phase === 'error' && (
            <p class="notice__text notice__text--warning" role="alert">
              {vi.extractFailed}
            </p>
          )}
        </section>
      )}

      <div class="workspace">
        <main class={`content${status === 'ready' ? ' content--document' : ''}`} ref={contentRef}>
          {status === 'empty' && (
            <div class="empty">
              <h1>{vi.appName}</h1>
              <p class="empty__title">{vi.emptyTitle}</p>
              <p class="empty__hint">{vi.emptyHint}</p>
              <button type="button" class="empty__action" onClick={() => inputRef.current?.click()}>
                {vi.chooseFile}
              </button>
              <p class="empty__drop">{vi.dropHint}</p>
            </div>
          )}

          {status === 'opening' && <p class="status">{vi.loading}</p>}

          {status === 'error' && (
            <div class="empty" role="alert">
              <h1>{vi.errorTitle}</h1>
              <p class="empty__hint">{errorMessage(error)}</p>
              <button type="button" class="empty__action" onClick={() => inputRef.current?.click()}>
                {vi.retry}
              </button>
            </div>
          )}

          {status === 'ready' && doc && (
            <PageList
              doc={doc}
              scale={scale}
              sizes={pageSizes}
              fallbackSize={fallbackSize}
              highlight={highlight}
              ocrPages={ocrPages}
              scrollerRef={contentRef}
              onMeasured={handleMeasured}
              onCurrentPageChange={handleCurrentPageChange}
              onRenderError={handleRenderError}
            />
          )}
        </main>

        {status === 'ready' && sidebarOpen && !focusMode && (
          <Sidebar
            toc={toc}
            currentPage={pageNumber}
            building={analysis.phase === 'extracting'}
            index={searchIndex}
            wordsPerMinute={readingWordsPerMinute}
            focus={{
              timer,
              remainingMs: remainingTimerMs,
              chapterMinutes,
              focusMinutes,
              breakMinutes,
              bandHeight,
              fullscreen,
              statsToday: todayStats,
              statsRecent: recentStats,
              onStartChapter: startChapterTimer,
              onStartPomodoro: startPomodoroTimer,
              onToggleTimer: toggleTimer,
              onStopTimer: stopCurrentTimer,
              onChangeFocusMinutes: (value) => setFocusMinutes(clampMinutes(value)),
              onChangeBreakMinutes: (value) => setBreakMinutes(clampMinutes(value, 1, 60)),
              onChangeBandHeight: (value) => setBandHeight(clampBandHeight(value)),
              onToggleFocusMode: toggleFocusMode,
              onToggleFullscreen: toggleFullscreen,
            }}
            settings={{
              theme: settings.theme,
              onChangeTheme: settings.onChangeTheme,
              ai: ai.panel,
              wordsPerMinute: readingWordsPerMinute,
              onChangeWordsPerMinute: settings.onChangeWordsPerMinute,
              autoOpenPdf: settings.autoOpenPdf,
              autoOpenSupported: settings.autoOpenSupported,
              onToggleAutoOpen: settings.onToggleAutoOpen,
              documentName: status === 'ready' && docId !== null ? fileName : null,
              onDeleteDocument: () => void handleDeleteDocument(),
              onDeleteAll: () => void handleDeleteAll(),
            }}
            summary={{
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
              onSelectPage: goToPage,
              canSummarizeAll: status === 'ready' && toc !== null && toc.items.length > 0,
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
            }}
            semantic={semantic}
            flashPanel={{
              flashcards,
              hasDocument: docId !== null,
              documentName: fileName,
              canGenerate: currentSection !== null,
              aiConfigured: aiSupported && aiConfigProblem(aiSettings, aiKey) === null,
              sectionLabel: currentSection
                ? currentSection.title ||
                  vi.summarySectionRange(currentSection.startPage, currentSection.endPage)
                : null,
              onOpenSettings: () => {},
              onSelectPage: goToPage,
            }}
            askPanel={{
              ask,
              hasDocument: docId !== null,
              hasText: extractedPages.some((page) => page.text.trim() !== ''),
              configured: ai.configured,
              semanticReady: semantic.state === 'ready',
              providerId: aiSettings.providerId,
              onOpenSettings: () => {},
              onSelectCitation: handleCitation,
            }}
            summarizedSpans={summarizedSpans}
            searchRequest={searchRequest}
            onSelectPage={goToPage}
            onSelectResult={handleSearchResult}
          />
        )}
      </div>

      {focusMode && (
        <>
          <div
            class="focus-band"
            style={{ top: `${bandTop}px`, height: `${bandHeight}px` }}
            aria-hidden="true"
          />
          <div class="focus-controls" role="group" aria-label={vi.focusModeTitle}>
            {timer.status !== 'idle' && (
              <span class="focus-controls__timer">
                {timerModeLabel(timer.mode)} · {formatTimer(remainingTimerMs)}
              </span>
            )}
            <button type="button" class="focus-button" onClick={toggleFullscreen}>
              {fullscreen ? vi.focusExitFullscreen : vi.focusFullscreen}
            </button>
            <button
              type="button"
              class="focus-button focus-button--primary"
              onClick={toggleFocusMode}
            >
              {vi.focusModeOff}
            </button>
          </div>
          <p class="focus-move-hint">{vi.focusMoveHint}</p>
        </>
      )}

      {toast !== null && (
        <div class="toast" role="status">
          <span>{toast}</span>
          <button
            type="button"
            class="toast__close"
            aria-label={vi.toastDismiss}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {ai.consentOpen && (
        <Dialog titleId="ai-consent-title" onClose={ai.cancelConsent}>
          <h2 class="consent-dialog__title" id="ai-consent-title">
            {vi.aiConsentTitle}
          </h2>
          <p class="consent-dialog__body">
            {vi.aiConsentBody(vi.aiProviders[aiSettings.providerId])}
          </p>
          <div class="consent-dialog__actions">
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={ai.acceptConsent}
            >
              {vi.aiConsentAccept}
            </button>
            <button type="button" class="settings-button" onClick={ai.cancelConsent}>
              {vi.aiConsentCancel}
            </button>
          </div>
        </Dialog>
      )}

      {isDragging && <div class="drop-overlay">{vi.dropActive}</div>}
    </div>
  );
}
