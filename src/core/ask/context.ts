import type { Chunk } from '../embed/types';
import { estimateTokens } from '../summarize/tokens';

/** Ngân sách token đầu vào cho phần ngữ cảnh của một câu hỏi. */
export const ASK_CONTEXT_TOKEN_BUDGET = 6000;
/** Số đoạn tối đa lấy về từ bộ xếp hạng trước khi cắt theo ngân sách. */
export const ASK_TOP_K = 8;

export type AskContext = {
  /** Các đoạn thực sự được gửi đi; trích dẫn chỉ hợp lệ với trang của các đoạn này. */
  chunks: Chunk[];
  text: string;
  tokens: number;
};

export function pageLabel(page: number): string {
  return `[Trang ${page}]`;
}

/**
 * Chọn đoạn theo thứ tự liên quan cho tới khi hết ngân sách (đoạn đầu luôn được
 * lấy, kể cả khi riêng nó vượt ngân sách), rồi xếp lại theo thứ tự trang để đọc
 * liền mạch. Mỗi đoạn gắn nhãn trang.
 */
export function buildContext(ranked: readonly Chunk[], budgetTokens = ASK_CONTEXT_TOKEN_BUDGET) {
  const picked: Chunk[] = [];
  let tokens = 0;

  for (const chunk of ranked) {
    const cost = estimateTokens(chunk.text) + 8;
    if (picked.length > 0 && tokens + cost > budgetTokens) break;
    picked.push(chunk);
    tokens += cost;
  }

  const ordered = [...picked].sort((a, b) => a.page - b.page || a.index - b.index);
  const text = ordered.map((chunk) => `${pageLabel(chunk.page)}\n${chunk.text}`).join('\n\n');
  return { chunks: ordered, text, tokens } satisfies AskContext;
}
