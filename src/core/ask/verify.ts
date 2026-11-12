import { normalizeVietnamese } from '../search';
import type { Citation, ParsedAnswer, VerifiedAnswer } from './types';

/** Quote ngắn hơn mức này (sau chuẩn hoá) quá dễ khớp nhầm nên không được tin. */
export const MIN_QUOTE_LENGTH = 8;

/** Chuẩn hoá để so khớp: NFC, không dấu, bỏ dấu ba chấm/ngoặc kép ở hai đầu, gộp khoảng trắng. */
export function comparableQuote(text: string): string {
  return normalizeVietnamese(text.normalize('NFC'))
    .replace(/^[\s"'“”‘’«».…]+|[\s"'“”‘’«».…]+$/gu, '')
    .replace(/\s+/g, ' ');
}

export type VerifyInput = {
  parsed: ParsedAnswer;
  /** Các trang có đoạn đã gửi cho model. */
  sentPages: ReadonlySet<number>;
  /** Văn bản của một trang trong tài liệu (chữ đã trích hoặc OCR). */
  pageText: (page: number) => string | undefined;
};

/**
 * Giữ lại trích dẫn có trang nằm trong ngữ cảnh đã gửi và quote xuất hiện
 * trong đúng trang đó. Trích dẫn khác bị bỏ; câu trả lời "tìm thấy" mà không
 * còn trích dẫn nào hợp lệ được đánh dấu chưa kiểm chứng.
 */
export function verifyCitations({ parsed, sentPages, pageText }: VerifyInput): VerifiedAnswer {
  const kept: Citation[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const citation of parsed.citations) {
    const quote = comparableQuote(citation.quote);
    const text = sentPages.has(citation.page) ? pageText(citation.page) : undefined;
    const valid =
      quote.length >= MIN_QUOTE_LENGTH &&
      text !== undefined &&
      comparableQuote(text).includes(quote);

    if (!valid) {
      dropped += 1;
      continue;
    }
    const id = `${citation.page}\u0000${quote}`;
    if (seen.has(id)) continue;
    seen.add(id);
    kept.push({ page: citation.page, quote: citation.quote.trim() });
  }

  const unverified = parsed.found && (dropped > 0 || kept.length === 0);
  return {
    answer: parsed.answer,
    found: parsed.found,
    citations: parsed.found ? kept : [],
    dropped,
    unverified,
  };
}
