import type { RefObject } from 'preact';
import { useCallback, useEffect, useRef } from 'preact/hooks';

/**
 * Phạm vi của các việc nền (tóm tắt một mục, tóm tắt toàn bộ, OCR). Mỗi việc nhớ `generation`
 * lúc bắt đầu; `stop` tăng số này và huỷ mọi request, nên kết quả về muộn bị bỏ.
 */
export type RunScope = {
  /** Tăng mỗi khi mở hoặc đóng tài liệu để bỏ kết quả của lượt cũ. */
  generationRef: RefObject<number>;
  summaryAbortRef: RefObject<AbortController | null>;
  batchAbortRef: RefObject<AbortController | null>;
  ocrAbortRef: RefObject<AbortController | null>;
  /** Dừng mọi việc nền đang chạy (mở file khác, đóng, xoá dữ liệu). */
  stop: () => void;
};

export function useRunScope(): RunScope {
  const generationRef = useRef(0);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    generationRef.current += 1;
    summaryAbortRef.current?.abort();
    batchAbortRef.current?.abort();
    ocrAbortRef.current?.abort();
    summaryAbortRef.current = null;
    batchAbortRef.current = null;
    ocrAbortRef.current = null;
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

  return { generationRef, summaryAbortRef, batchAbortRef, ocrAbortRef, stop };
}
