import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ASK_TOP_K } from '../core/ask/context';
import { askQuestion } from '../core/ask/run';
import type { QaRecord } from '../core/ask/types';
import { hybridRetrieve } from '../core/embed/retrieve';
import { isLLMError } from '../core/llm/errors';
import { getProvider } from '../core/llm';
import { resolveModel } from '../core/llm/models';
import { providerOriginPattern } from '../core/llm/permissions';
import type { AiSettings } from '../core/llm/settings';
import type { TextPage } from '../core/summarize/chunk';
import { searchIndex as runSearch, type SearchIndex } from '../core/search';
import { clearQaForDoc, deleteQa, loadQa, saveQa } from '../storage/db';
import { vi } from '../i18n/vi';
import { aiErrorMessage } from './ai-errors';
import type { SemanticApi } from './semantic';

export type AskApi = {
  history: readonly QaRecord[];
  asking: boolean;
  error: string | null;
  /** Gọi trực tiếp trong thao tác bấm; hỏi xong thì thêm vào đầu lịch sử. */
  ask: (question: string) => void;
  cancel: () => void;
  remove: (id: string) => void;
  clear: () => void;
};

type Input = {
  docId: string | null;
  pages: readonly TextPage[];
  index: SearchIndex | null;
  semantic: SemanticApi;
  settings: AiSettings;
  apiKey: string;
  /** Chạy `proceed` ngay nếu đã đồng ý gửi nội dung; chưa thì mở hộp thoại rồi chạy sau. */
  ensureConsent: (proceed: () => void) => void;
};

const KEYWORD_POOL = 30;

/**
 * Hỏi đáp trên tài liệu đang mở. Mỗi câu hỏi là một request; đổi tài liệu hoặc
 * đóng viewer thì huỷ, kết quả về muộn không được ghi vào tài liệu khác.
 */
export function useAsk({
  docId,
  pages,
  index,
  semantic,
  settings,
  apiKey,
  ensureConsent,
}: Input): AskApi {
  const [history, setHistory] = useState<QaRecord[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<{ abort: AbortController } | null>(null);
  const scopeRef = useRef(0);

  const pageMap = useMemo(() => new Map(pages.map((page) => [page.page, page.text])), [pages]);

  useEffect(() => {
    scopeRef.current += 1;
    const scope = scopeRef.current;
    runRef.current?.abort.abort();
    runRef.current = null;
    setHistory([]);
    setAsking(false);
    setError(null);
    if (docId === null) return;
    void loadQa(docId).then((loaded) => {
      if (scopeRef.current === scope) setHistory(loaded);
    });
  }, [docId]);

  useEffect(
    () => () => {
      runRef.current?.abort.abort();
    },
    [],
  );

  const run = useCallback(
    async (question: string) => {
      if (docId === null) return;
      const scope = scopeRef.current;
      const runDocId = docId;

      // Phải là lời gọi đầu tiên để còn nằm trong thao tác của người dùng.
      const chromeApi = typeof chrome === 'undefined' ? null : chrome;
      if (chromeApi?.permissions) {
        const granted = await chromeApi.permissions.request({
          origins: [providerOriginPattern(settings.providerId, settings.baseUrl)],
        });
        if (scopeRef.current !== scope) return;
        if (!granted) {
          setError(vi.aiPermissionDenied);
          return;
        }
      }

      const abort = new AbortController();
      runRef.current?.abort.abort();
      const current = { abort };
      runRef.current = current;
      const isActive = () => runRef.current === current && scopeRef.current === scope;
      setAsking(true);
      setError(null);

      try {
        const keywordHits = index
          ? runSearch(index, question, { ignoreDiacritics: true, limit: KEYWORD_POOL }).map(
              (hit) => ({ page: hit.page, text: hit.text }),
            )
          : [];

        // Có chỉ mục theo ý nghĩa thì xếp hạng lai; lỗi hoặc chưa có thì dùng từ khoá.
        let retrieved =
          semantic.state === 'ready'
            ? await semantic.search(question, keywordHits, ASK_TOP_K, { skipPermission: true })
            : null;
        if (!isActive()) return;
        retrieved ??= hybridRetrieve({
          chunks: semantic.chunks,
          records: [],
          queryVector: null,
          keywordHits,
          limit: ASK_TOP_K,
        });

        const record = await askQuestion({
          docId: runDocId,
          question,
          ranked: retrieved.map((item) => item.chunk),
          provider: getProvider(settings.providerId),
          providerId: settings.providerId,
          config: { apiKey: apiKey.trim(), baseUrl: settings.baseUrl },
          model: resolveModel(settings.providerId, settings.model),
          pageText: (page) => pageMap.get(page),
          signal: abort.signal,
        });
        if (!isActive()) return;

        if (record === null) {
          setError(vi.askNoContext);
          return;
        }
        await saveQa(record);
        if (!isActive()) return;
        setHistory((existing) => [record, ...existing]);
      } catch (caught) {
        if (!isActive()) return;
        if (isLLMError(caught) && caught.kind === 'cancelled')
          setError(vi.aiErrorMessages.cancelled);
        else setError(aiErrorMessage(caught, settings));
      } finally {
        if (runRef.current === current) {
          runRef.current = null;
          setAsking(false);
        }
      }
    },
    [docId, settings, apiKey, index, semantic, pageMap],
  );

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (text === '' || asking) return;
      ensureConsent(() => void run(text));
    },
    [asking, ensureConsent, run],
  );

  const cancel = useCallback(() => {
    runRef.current?.abort.abort();
  }, []);

  const remove = useCallback((id: string) => {
    setHistory((existing) => existing.filter((record) => record.id !== id));
    void deleteQa(id);
  }, []);

  const clear = useCallback(() => {
    if (docId === null) return;
    setHistory([]);
    void clearQaForDoc(docId);
  }, [docId]);

  return { history, asking, error, ask, cancel, remove, clear };
}
