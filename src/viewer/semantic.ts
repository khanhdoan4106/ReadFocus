import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { embedBatch, EMBED_BATCH_SIZE } from '../core/embed/api';
import { chunkPages } from '../core/embed/chunk';
import { LOCAL_EMBED_BATCH_SIZE, LocalEmbedError } from '../core/embed/local';
import { embedKey, resolveEmbedSource } from '../core/embed/models';
import { hybridRetrieve, type KeywordHit, type RetrievedChunk } from '../core/embed/retrieve';
import { chunksToEmbed, estimateEmbedWork, runEmbedding } from '../core/embed/run';
import type { Chunk, EmbeddingRecord, EmbedProgress, EmbedSource } from '../core/embed/types';
import { isLLMError, LLMError } from '../core/llm/errors';
import { providerOriginPattern } from '../core/llm/permissions';
import { providerRequiresKey, type AiSettings } from '../core/llm/settings';
import type { TextPage } from '../core/summarize/chunk';
import { loadEmbeddings, saveEmbeddings } from '../storage/db';
import { t } from '../i18n';
import { aiErrorMessage } from './ai-errors';
import { localModelMessage } from './hooks/useLocalModel';
import { localEmbed } from './local-embed';

/**
 * `unsupported`: provider không có embeddings (Anthropic) và chưa chọn "Trên máy"; `model-missing`:
 * chọn "Trên máy" nhưng chưa tải model; `missing-key`: chưa có key;
 * `empty`: chưa có chữ để tạo chỉ mục; `none`/`partial`/`ready`: mức độ đã có vector.
 */
export type SemanticState =
  'unsupported' | 'model-missing' | 'missing-key' | 'empty' | 'none' | 'partial' | 'ready';

export type SemanticApi = {
  state: SemanticState;
  providerId: AiSettings['providerId'];
  /** Nguồn là model chạy trên máy: không gửi gì ra ngoài, không cần key hay quyền truy cập. */
  local: boolean;
  model: string;
  chunks: readonly Chunk[];
  records: readonly EmbeddingRecord[];
  /** Số đoạn và số request cần gửi để hoàn tất chỉ mục. */
  pending: { chunks: number; requests: number };
  progress: EmbedProgress | null;
  error: string | null;
  /** Gọi trực tiếp trong thao tác bấm: `permissions.request` phải đứng đầu. */
  build: () => Promise<void>;
  cancel: () => void;
  /** Gọi trực tiếp trong thao tác gửi form. Ném `LLMError`-đã-dịch qua `error`. */
  search: (
    query: string,
    keywordHits: readonly KeywordHit[],
    limit: number,
    options?: { skipPermission?: boolean },
  ) => Promise<RetrievedChunk[] | null>;
  clearError: () => void;
};

type Input = {
  docId: string | null;
  pages: readonly TextPage[];
  settings: AiSettings;
  apiKey: string;
  /** Model trên máy đã nằm trong cache và dùng được. */
  localModelReady: boolean;
};

async function requestOrigin(settings: AiSettings): Promise<boolean> {
  const chromeApi = typeof chrome === 'undefined' ? null : chrome;
  if (!chromeApi?.permissions) return true;
  return chromeApi.permissions.request({
    origins: [providerOriginPattern(settings.providerId, settings.baseUrl)],
  });
}

/**
 * Chỉ mục ý nghĩa của tài liệu đang mở. Mọi lượt gọi mạng là do người dùng bấm
 * (tạo chỉ mục, gửi câu tìm); đổi tài liệu hoặc đóng viewer thì huỷ và bỏ kết quả về muộn.
 */
export function useSemanticIndex({
  docId,
  pages,
  settings,
  apiKey,
  localModelReady,
}: Input): SemanticApi {
  const providerId = settings.providerId;
  const baseUrl = settings.baseUrl;
  const { embedSource, embedModel } = settings;

  // Khoá nguồn khác nhau cho từng nguồn nên vector của nguồn khác không bao giờ dùng lẫn.
  const source = useMemo<EmbedSource | null>(
    () => resolveEmbedSource({ providerId, embedSource, embedModel, baseUrl }),
    [providerId, embedSource, embedModel, baseUrl],
  );
  const local = source?.providerId === 'local';
  const supported = source !== null;
  const model = source?.model ?? '';
  const key = useMemo(() => (source === null ? null : embedKey(source)), [source]);
  const chunks = useMemo(() => chunkPages(pages), [pages]);

  const [records, setRecords] = useState<EmbeddingRecord[]>([]);
  const [progress, setProgress] = useState<EmbedProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mỗi lượt chạy mang một thẻ; đổi tài liệu/nguồn làm thẻ cũ mất hiệu lực.
  const runRef = useRef<{ abort: AbortController } | null>(null);
  const queryRef = useRef<{ abort: AbortController } | null>(null);
  const scopeRef = useRef(0);

  const cancel = useCallback(() => {
    runRef.current?.abort.abort();
  }, []);

  // Nạp vector đã lưu cho đúng (tài liệu, nguồn); bỏ kết quả nếu phạm vi đã đổi.
  useEffect(() => {
    scopeRef.current += 1;
    const scope = scopeRef.current;
    runRef.current?.abort.abort();
    queryRef.current?.abort.abort();
    runRef.current = null;
    queryRef.current = null;
    setRecords([]);
    setProgress(null);
    setError(null);
    if (docId === null || key === null) return;

    void loadEmbeddings(docId, key).then((loaded) => {
      if (scopeRef.current === scope) setRecords(loaded);
    });
  }, [docId, key]);

  useEffect(
    () => () => {
      runRef.current?.abort.abort();
      queryRef.current?.abort.abort();
    },
    [],
  );

  const pendingChunks = useMemo(() => chunksToEmbed(chunks, records), [chunks, records]);
  const pending = useMemo(
    () => estimateEmbedWork(pendingChunks.length, EMBED_BATCH_SIZE),
    [pendingChunks],
  );

  const state: SemanticState = !supported
    ? 'unsupported'
    : local && !localModelReady
      ? 'model-missing'
      : !local && providerRequiresKey(providerId) && apiKey.trim() === ''
        ? 'missing-key'
        : chunks.length === 0
          ? 'empty'
          : pendingChunks.length === 0
            ? 'ready'
            : pendingChunks.length === chunks.length
              ? 'none'
              : 'partial';

  const build = useCallback(async () => {
    if (docId === null || source === null || key === null) return;
    const scope = scopeRef.current;
    const runDocId = docId;

    // Phải là lời gọi đầu tiên để còn nằm trong thao tác của người dùng. Model trên máy không cần quyền.
    if (!local) {
      const granted = await requestOrigin(settings);
      if (scopeRef.current !== scope) return;
      if (!granted) {
        setError(t.aiPermissionDenied);
        return;
      }
    }

    const abort = new AbortController();
    runRef.current?.abort.abort();
    const run = { abort };
    runRef.current = run;
    const isActive = () => runRef.current === run && scopeRef.current === scope;

    setError(null);
    setProgress({ done: 0, total: pendingChunks.length });
    try {
      await runEmbedding({
        docId: runDocId,
        key,
        chunks,
        existing: records,
        batchSize: local ? LOCAL_EMBED_BATCH_SIZE : EMBED_BATCH_SIZE,
        signal: abort.signal,
        embed: (texts, signal) =>
          local
            ? localEmbed.embed(texts, 'passage', signal)
            : embedBatch(source, { apiKey: apiKey.trim(), baseUrl }, texts, 'passage', { signal }),
        onBatch: async (batch) => {
          await saveEmbeddings(batch);
          if (!isActive()) return;
          setRecords((current) => {
            const ids = new Set(batch.map((record) => record.id));
            return [...current.filter((record) => !ids.has(record.id)), ...batch];
          });
        },
        onProgress: (value) => {
          if (isActive()) setProgress(value);
        },
      });
    } catch (caught) {
      if (!isActive()) return;
      if (caught instanceof LocalEmbedError) setError(localModelMessage(caught));
      else if (isLLMError(caught) && caught.kind === 'cancelled') {
        setError(t.aiErrorMessages.cancelled);
      } else setError(aiErrorMessage(caught, settings));
    } finally {
      if (runRef.current === run) {
        runRef.current = null;
        setProgress(null);
      }
    }
  }, [docId, source, key, local, settings, pendingChunks.length, chunks, records, apiKey, baseUrl]);

  const search = useCallback(
    async (
      query: string,
      keywordHits: readonly KeywordHit[],
      limit: number,
      options: { skipPermission?: boolean } = {},
    ) => {
      if (docId === null || source === null) return null;
      const scope = scopeRef.current;
      const text = query.trim();
      if (text === '') return [];

      if (!local && options.skipPermission !== true) {
        const granted = await requestOrigin(settings);
        if (scopeRef.current !== scope) return null;
        if (!granted) {
          setError(t.aiPermissionDenied);
          return null;
        }
      }

      const abort = new AbortController();
      queryRef.current?.abort.abort();
      const run = { abort };
      queryRef.current = run;
      setError(null);

      try {
        const [vector] = local
          ? await localEmbed.embed([text], 'query', abort.signal)
          : await embedBatch(source, { apiKey: apiKey.trim(), baseUrl }, [text], 'query', {
              signal: abort.signal,
            });
        if (queryRef.current !== run || scopeRef.current !== scope) return null;
        if (vector === undefined) throw new LLMError('bad-response', 'Missing query embedding');
        return hybridRetrieve({
          chunks,
          records,
          queryVector: vector,
          keywordHits,
          limit,
        });
      } catch (caught) {
        if (queryRef.current === run && scopeRef.current === scope) {
          setError(
            caught instanceof LocalEmbedError
              ? localModelMessage(caught)
              : aiErrorMessage(caught, settings),
          );
        }
        return null;
      } finally {
        if (queryRef.current === run) queryRef.current = null;
      }
    },
    [docId, source, local, settings, apiKey, baseUrl, chunks, records],
  );

  return {
    state,
    providerId,
    local,
    model,
    chunks,
    records,
    pending,
    progress,
    error,
    build,
    cancel,
    search,
    clearError: () => setError(null),
  };
}
