import { mergeLineRects, normalizeRect } from '../core/annotate/rect';
import { mapRangeToSpans } from '../core/annotate/spans';
import type { Rect } from '../core/annotate/types';

/** Các span chữ của text layer theo thứ tự đọc (bỏ span bọc `markedContent`). */
function textSpans(textLayer: HTMLElement): HTMLElement[] {
  return Array.from(textLayer.querySelectorAll<HTMLElement>('span')).filter(
    (span) => !span.classList.contains('markedContent') && span.childElementCount === 0,
  );
}

/**
 * Tính lại rect (chuẩn hóa 0..1 theo trang) của khoảng ký tự `[start, end)` trong văn bản trang,
 * từ các span thật của text layer. Trả `null` nếu text layer chưa có chữ, ánh xạ thất bại hoặc
 * trình duyệt không cho rect: khi đó KHÔNG được vẽ rect cũ.
 */
export function reflowRects(
  textLayer: HTMLElement,
  pageElement: HTMLElement,
  pageText: string,
  start: number,
  end: number,
): Rect[] | null {
  const spans = textSpans(textLayer);
  if (spans.length === 0) return null;
  const segments = mapRangeToSpans(
    spans.map((span) => span.textContent ?? ''),
    pageText,
    start,
    end,
  );
  if (segments === null) return null;

  const pageBox = pageElement.getBoundingClientRect();
  if (pageBox.width <= 0 || pageBox.height <= 0) return null;
  const size = { width: pageBox.width, height: pageBox.height };

  const rects: Rect[] = [];
  for (const segment of segments) {
    const node = spans[segment.span]?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const range = document.createRange();
    range.setStart(node, segment.from);
    range.setEnd(node, segment.to);
    for (const box of Array.from(range.getClientRects())) {
      if (box.width <= 0 || box.height <= 0) continue;
      rects.push(
        normalizeRect(
          { x: box.left - pageBox.left, y: box.top - pageBox.top, w: box.width, h: box.height },
          size,
        ),
      );
    }
  }
  const merged = mergeLineRects(rects);
  return merged.length > 0 ? merged : null;
}
