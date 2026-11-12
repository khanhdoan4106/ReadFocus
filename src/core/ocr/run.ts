import type { OcrEngine, OcrInput, OcrPageResult, OcrProgress } from './types';

export type RunOcrOptions = {
  engine: OcrEngine;
  /** Các trang cần nhận dạng, theo thứ tự xử lý. */
  pages: readonly number[];
  /** Render một trang ra ảnh đủ độ phân giải cho OCR. */
  renderPage: (page: number, signal: AbortSignal) => Promise<OcrInput>;
  signal: AbortSignal;
  /** Gọi ngay khi một trang xong để UI lưu và hiện kết quả từng phần. */
  onPage?: (page: number, result: OcrPageResult) => void | Promise<void>;
  onProgress?: (progress: OcrProgress) => void;
  /** Số trang lỗi liên tiếp thì dừng cả lượt (engine hỏng, không phải lỗi riêng trang). */
  maxConsecutiveFailures?: number;
};

export type RunOcrResult = {
  results: Map<number, OcrPageResult>;
  /** Trang không nhận dạng được. */
  failed: number[];
};

function abortError(): DOMException {
  return new DOMException('OCR đã bị huỷ', 'AbortError');
}

/**
 * Chạy OCR tuần tự từng trang. Huỷ giữa chừng thì dừng hẳn worker ngay (không
 * chờ trang đang chạy) và ném `AbortError`; kết quả các trang đã xong vẫn nằm
 * trong lời gọi `onPage` trước đó.
 */
export async function runOcr(options: RunOcrOptions): Promise<RunOcrResult> {
  const { engine, pages, signal } = options;
  const maxFailures = options.maxConsecutiveFailures ?? 3;
  const results = new Map<number, OcrPageResult>();
  const failed: number[] = [];

  let stopWorker: (() => void) | null = null;
  const aborted = new Promise<never>((_, reject) => {
    stopWorker = () => {
      void engine.terminate().catch(() => undefined);
      reject(abortError());
    };
  });
  // Không để lỗi "chưa ai bắt" nếu lượt kết thúc bình thường.
  aborted.catch(() => undefined);
  const onAbort = () => stopWorker?.();
  if (signal.aborted) throw abortError();
  signal.addEventListener('abort', onAbort, { once: true });

  let consecutive = 0;
  try {
    for (const [index, page] of pages.entries()) {
      if (signal.aborted) throw abortError();

      try {
        const input = await Promise.race([options.renderPage(page, signal), aborted]);
        const result = await Promise.race([engine.recognize(input), aborted]);
        results.set(page, result);
        consecutive = 0;
        await options.onPage?.(page, result);
      } catch (error) {
        if (signal.aborted) throw abortError();
        failed.push(page);
        consecutive += 1;
        if (consecutive >= maxFailures) throw error;
      }

      options.onProgress?.({ done: index + 1, total: pages.length, page });
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }

  return { results, failed };
}

/**
 * Tạo engine, chạy `task`, rồi luôn dừng worker (kể cả khi lỗi hoặc huỷ) để
 * không còn tiến trình nền nào sau khi xong.
 */
export async function withOcrEngine<T>(
  createEngine: () => Promise<OcrEngine>,
  task: (engine: OcrEngine) => Promise<T>,
): Promise<T> {
  const engine = await createEngine();
  try {
    return await task(engine);
  } finally {
    await engine.terminate().catch(() => undefined);
  }
}
