import { DEFAULT_INPUT_TOKEN_BUDGET, splitIntoChunks, type TextPage } from './chunk';

/** Số request và token đầu vào cần cho một lần tóm tắt. */
export type WorkEstimate = {
  requests: number;
  inputTokens: number;
};

export type PageSpan = {
  startPage: number;
  endPage: number;
};

/** Các trang nằm trong khoảng của một mục. */
export function pagesInSpan(pages: readonly TextPage[], span: PageSpan): TextPage[] {
  return pages.filter((page) => page.page >= span.startPage && page.page <= span.endPage);
}

/**
 * Ước lượng trước khi gọi API: mỗi đoạn cần một request, và mục bị chia đoạn
 * cần thêm một request gộp. Token chỉ tính phần văn bản gửi đi, không tính
 * prompt, để con số hiển thị là mức tối thiểu.
 */
export function estimateSectionWork(
  pages: readonly TextPage[],
  maxInputTokens = DEFAULT_INPUT_TOKEN_BUDGET,
): WorkEstimate {
  const chunks = splitIntoChunks(pages, maxInputTokens);
  if (chunks.length === 0) return { requests: 0, inputTokens: 0 };

  const inputTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  return { requests: chunks.length + (chunks.length > 1 ? 1 : 0), inputTokens };
}

/** Tổng hợp ước lượng của nhiều mục (dùng cho "Tóm tắt toàn bộ"). */
export function estimateSpansWork(
  spans: readonly PageSpan[],
  pages: readonly TextPage[],
  maxInputTokens = DEFAULT_INPUT_TOKEN_BUDGET,
): WorkEstimate {
  return spans.reduce<WorkEstimate>(
    (total, span) => {
      const part = estimateSectionWork(pagesInSpan(pages, span), maxInputTokens);
      return {
        requests: total.requests + part.requests,
        inputTokens: total.inputTokens + part.inputTokens,
      };
    },
    { requests: 0, inputTokens: 0 },
  );
}

/**
 * Chạy tối đa `limit` việc song song, giữ thứ tự kết quả. Dừng nhận việc mới
 * khi signal bị huỷ; lỗi của một việc làm hỏng cả lượt để UI báo đúng lỗi.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));

  const run = async (): Promise<void> => {
    for (;;) {
      signal?.throwIfAborted();
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await worker(item, index);
    }
  };

  await Promise.all(Array.from({ length: width }, run));
  return results;
}
