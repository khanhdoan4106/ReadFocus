import { mergeLineRects, normalizeRect } from '../core/annotate/rect';
import type { Rect } from '../core/annotate/types';

export type PageSelection = {
  page: number;
  text: string;
  /** Vị trí tương đối (0..1) của vùng chọn trong text layer, để chọn đúng chỗ khi chữ lặp lại. */
  ratio: number;
  /** Rect theo tọa độ trang đã chuẩn hóa, đã gộp theo dòng. */
  rects: Rect[];
  /** Điểm trên màn hình để đặt thanh nổi (cuối vùng chọn). */
  anchor: { x: number; y: number };
};

/** Đọc vùng bôi đen hiện tại nếu nó nằm gọn trong text layer của một trang. */
export function readPageSelection(): PageSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);

  const container =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const textLayer = container?.closest<HTMLElement>('.textLayer');
  const pageElement = textLayer?.closest<HTMLElement>('.pdf-page');
  const slot = pageElement?.closest<HTMLElement>('.page-slot');
  if (!textLayer || !pageElement || !slot) return null;

  const page = Number(slot.dataset.page);
  const text = selection.toString();
  if (!Number.isFinite(page) || text.trim() === '') return null;

  const pageBox = pageElement.getBoundingClientRect();
  if (pageBox.width <= 0 || pageBox.height <= 0) return null;
  const size = { width: pageBox.width, height: pageBox.height };
  const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (clientRects.length === 0) return null;
  const rects = mergeLineRects(
    clientRects.map((r) =>
      normalizeRect(
        { x: r.left - pageBox.left, y: r.top - pageBox.top, w: r.width, h: r.height },
        size,
      ),
    ),
  );

  const before = document.createRange();
  before.selectNodeContents(textLayer);
  before.setEnd(range.startContainer, range.startOffset);
  const total = textLayer.textContent?.length ?? 0;
  const ratio = total > 0 ? before.toString().length / total : 0;

  const last = clientRects[clientRects.length - 1] as DOMRect;
  return { page, text, ratio, rects, anchor: { x: last.right, y: last.bottom } };
}
