import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  deleteModelFiles,
  isModelCached,
  LocalEmbedError,
  type DownloadProgress,
} from '../../core/embed/local';
import { t } from '../../i18n';
import { localEmbed, openModelCache } from '../local-embed';

/** `unsupported`: môi trường không có Cache API hoặc Worker (không thể dùng model trên máy). */
export type LocalModelState =
  'checking' | 'unsupported' | 'absent' | 'downloading' | 'ready' | 'error';

export function localModelMessage(error: unknown): string {
  if (error instanceof LocalEmbedError) {
    if (error.code === 'cancelled') return t.localModelCancelled;
    if (error.code === 'not-downloaded') return t.localModelNotDownloaded;
    if (error.code === 'download-failed') return t.localModelDownloadFailed;
  }
  return t.localModelRunFailed;
}

/**
 * Trạng thái model embedding trên máy. Chỉ `download` được phép gọi mạng (tới Hugging Face),
 * và chỉ chạy sau khi giao diện đã hiện hộp xác nhận dung lượng và người dùng đồng ý.
 */
export function useLocalModel() {
  const [state, setState] = useState<LocalModelState>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cache = await openModelCache().catch(() => null);
      if (!active) return;
      if (cache === null || typeof Worker === 'undefined') {
        setState('unsupported');
        return;
      }
      const cached = await isModelCached(cache).catch(() => false);
      if (active) setState(cached ? 'ready' : 'absent');
    })();
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  const download = useCallback(async () => {
    if (abortRef.current !== null) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    setProgress({ loaded: 0, total: 0 });
    setState('downloading');
    try {
      await localEmbed.download(abort.signal, setProgress);
      setState('ready');
    } catch (caught) {
      const cancelled = caught instanceof LocalEmbedError && caught.code === 'cancelled';
      setState('absent');
      if (!cancelled) setError(localModelMessage(caught));
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const remove = useCallback(async () => {
    localEmbed.dispose();
    const cache = await openModelCache().catch(() => null);
    if (cache !== null) await deleteModelFiles(cache);
    setError(null);
    setState('absent');
  }, []);

  return { state, progress, error, download, cancel, remove };
}

export type LocalModelApi = ReturnType<typeof useLocalModel>;
