import { createTextAnchor } from './anchor';
import { normalizeForMatch, normalizeWithMap } from './normalize';
import type { Rect, TextAnchor } from './types';

/**
 * Đổi đoạn chữ người dùng bôi đen (lấy từ `Selection.toString()`) thành neo trong văn bản
 * trang đã trích. Văn bản trên text layer và văn bản đã trích không giống hệt nhau (khác chỗ
 * ngắt dòng, khoảng trắng), nên so khớp sau chuẩn hóa. Nhiều chỗ khớp thì chọn chỗ có vị trí
 * tương đối gần `positionRatio` (offset của vùng chọn trong text layer / độ dài text layer).
 * Trả `null` nếu không tìm thấy: người gọi chuyển sang highlight vùng.
 */
export function locateSelection(
  pageText: string,
  selected: string,
  positionRatio: number,
  rects: readonly Rect[],
): TextAnchor | null {
  const quote = normalizeForMatch(selected).trim();
  if (quote === '') return null;

  const page = normalizeWithMap(pageText);
  const target = Math.min(1, Math.max(0, positionRatio)) * page.text.length;
  let best: { index: number; distance: number } | null = null;
  for (
    let from = page.text.indexOf(quote);
    from !== -1;
    from = page.text.indexOf(quote, from + 1)
  ) {
    const distance = Math.abs(from - target);
    if (best === null || distance < best.distance) best = { index: from, distance };
  }
  if (best === null) return null;

  const start = page.starts[best.index] as number;
  const end = page.ends[best.index + quote.length - 1] as number;
  return createTextAnchor(pageText, start, end, rects);
}

/** Hình chữ nhật bao quanh nhiều rect (dùng khi phải đổi highlight chữ thành highlight vùng). */
export function boundingRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
