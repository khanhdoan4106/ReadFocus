import { isLLMError } from '../llm/errors';
import type { LLMErrorKind } from '../llm/types';
import { mapWithConcurrency } from './work';

/** Lỗi chỉ liên quan tới một mục: bỏ qua mục đó và chạy tiếp mục khác. */
const ITEM_ERROR_KINDS: ReadonlySet<LLMErrorKind> = new Set([
  'truncated',
  'bad-response',
  'context-too-long',
]);

/**
 * Lỗi riêng của một mục thì chỉ mục đó thất bại. Mọi lỗi còn lại (key, quota,
 * model, giới hạn tốc độ, mạng, lỗi lạ) sẽ lặp lại ở mọi mục nên dừng cả lượt,
 * tránh tiếp tục gọi API và tốn hạn mức.
 */
export function isItemLevelError(error: unknown): boolean {
  return isLLMError(error) && ITEM_ERROR_KINDS.has(error.kind);
}

export type BatchFailure<T> = { item: T; error: unknown };

export type BatchResult<T> = {
  /** Các mục lỗi riêng; người dùng có thể thử lại. */
  failed: BatchFailure<T>[];
  /** Lỗi làm dừng cả lượt (không phải do người dùng huỷ). */
  fatal: unknown;
  /** Người dùng đã huỷ. */
  cancelled: boolean;
};

/**
 * Chạy `worker` cho từng mục với tối đa `concurrency` request song song.
 * Lỗi nặng hoặc huỷ sẽ abort signal truyền cho worker và không mục nào được
 * bắt đầu sau đó.
 */
export async function runSummaryBatch<T>(options: {
  items: readonly T[];
  concurrency: number;
  signal: AbortSignal;
  worker: (item: T, signal: AbortSignal) => Promise<void>;
}): Promise<BatchResult<T>> {
  const inner = new AbortController();
  const forward = () => inner.abort();
  if (options.signal.aborted) inner.abort();
  else options.signal.addEventListener('abort', forward, { once: true });

  const result: BatchResult<T> = { failed: [], fatal: undefined, cancelled: false };

  try {
    await mapWithConcurrency(
      options.items,
      options.concurrency,
      async (item) => {
        try {
          await options.worker(item, inner.signal);
        } catch (error) {
          // Worker khác bị abort vì lỗi nặng đã ghi nhận thì không ghi đè lỗi gốc.
          if (options.signal.aborted || result.fatal !== undefined) throw error;
          if (isItemLevelError(error)) {
            result.failed.push({ item, error });
            return;
          }
          result.fatal = error;
          inner.abort();
          throw error;
        }
      },
      inner.signal,
    );
  } catch {
    // Lỗi đã được ghi vào `result`; huỷ do người dùng thì đánh dấu bên dưới.
  } finally {
    options.signal.removeEventListener('abort', forward);
  }

  result.cancelled = options.signal.aborted;
  return result;
}
