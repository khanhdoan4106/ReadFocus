import { normalizeForMatch, normalizeWithMap } from './normalize';
import type { Rect, TextAnchor } from './types';

/** Độ dài ngữ cảnh lưu quanh trích dẫn. */
export const CONTEXT_LENGTH = 32;

/** Thu hẹp khoảng chọn để không bắt đầu/kết thúc bằng khoảng trắng. */
function trimRange(text: string, start: number, end: number): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, text.length));
  let e = Math.max(s, Math.min(end, text.length));
  while (s < e && /\s/u.test(text[s] as string)) s += 1;
  while (e > s && /\s/u.test(text[e - 1] as string)) e -= 1;
  return { start: s, end: e };
}

/**
 * Tạo neo cho đoạn chữ `[start, end)` của văn bản trang. Trả `null` nếu khoảng chọn chỉ
 * gồm khoảng trắng.
 */
export function createTextAnchor(
  pageText: string,
  start: number,
  end: number,
  rects: readonly Rect[] = [],
): TextAnchor | null {
  const range = trimRange(pageText, start, end);
  if (range.end <= range.start) return null;
  return {
    type: 'text',
    start: range.start,
    end: range.end,
    quote: pageText.slice(range.start, range.end),
    prefix: pageText.slice(Math.max(0, range.start - CONTEXT_LENGTH), range.start),
    suffix: pageText.slice(range.end, range.end + CONTEXT_LENGTH),
    rects: rects.map((rect) => ({ ...rect })),
  };
}

export type AnchorResolution =
  /** Vẫn đúng chỗ cũ. */
  | { status: 'ok'; start: number; end: number }
  /** Văn bản trang đã đổi nhưng tìm lại được trích dẫn, ở vị trí mới. */
  | { status: 'moved'; start: number; end: number }
  /** Không tìm lại được: hiện trong khu "mồ côi" để xóa hoặc gắn lại. */
  | { status: 'orphan' };

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

/**
 * Tìm lại vị trí của neo trong văn bản trang hiện tại. Thử offset cũ trước; lệch thì tìm theo
 * trích dẫn (sau khi chuẩn hóa NFC và khoảng trắng), nhiều chỗ khớp thì chọn chỗ có ngữ cảnh
 * trước/sau giống nhất, hòa thì chọn chỗ gần offset cũ; không có chỗ nào thì mồ côi.
 */
export function resolveTextAnchor(anchor: TextAnchor, pageText: string): AnchorResolution {
  const quote = normalizeForMatch(anchor.quote).trim();
  if (quote === '') return { status: 'orphan' };

  if (
    anchor.end <= pageText.length &&
    anchor.start < anchor.end &&
    normalizeForMatch(pageText.slice(anchor.start, anchor.end)).trim() === quote
  ) {
    return { status: 'ok', start: anchor.start, end: anchor.end };
  }

  const page = normalizeWithMap(pageText);
  const prefix = normalizeForMatch(anchor.prefix);
  const suffix = normalizeForMatch(anchor.suffix);

  let best: { index: number; score: number; distance: number } | null = null;
  for (
    let from = page.text.indexOf(quote);
    from !== -1;
    from = page.text.indexOf(quote, from + 1)
  ) {
    const before = page.text.slice(Math.max(0, from - prefix.length), from);
    const after = page.text.slice(from + quote.length, from + quote.length + suffix.length);
    const score = commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
    const distance = Math.abs((page.starts[from] ?? 0) - anchor.start);
    if (best === null || score > best.score || (score === best.score && distance < best.distance)) {
      best = { index: from, score, distance };
    }
  }
  if (best === null) return { status: 'orphan' };

  const start = page.starts[best.index] as number;
  const end = page.ends[best.index + quote.length - 1] as number;
  return { status: 'moved', start, end };
}
