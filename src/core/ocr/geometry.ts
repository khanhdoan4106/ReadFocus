import type { OcrBox } from './types';

export type Size = { width: number; height: number };

/** Hình chữ nhật theo pixel CSS, gốc ở góc trên trái của trang đang hiển thị. */
export type PageRect = { left: number; top: number; width: number; height: number };

/**
 * Đổi hộp bao từ (pixel của ảnh OCR) sang hình chữ nhật trên trang đang hiển
 * thị. Tỉ lệ lấy từ kích thước ảnh OCR so với kích thước trang hiện tại, nên
 * đúng với mọi mức zoom mà không cần biết hệ số render lúc OCR.
 */
export function boxToPageRect(box: OcrBox, image: Size, rendered: Size): PageRect | null {
  if (image.width <= 0 || image.height <= 0 || rendered.width <= 0 || rendered.height <= 0) {
    return null;
  }
  const scaleX = rendered.width / image.width;
  const scaleY = rendered.height / image.height;

  const x0 = Math.min(Math.max(box.x0, 0), image.width);
  const y0 = Math.min(Math.max(box.y0, 0), image.height);
  const x1 = Math.min(Math.max(box.x1, 0), image.width);
  const y1 = Math.min(Math.max(box.y1, 0), image.height);
  if (x1 <= x0 || y1 <= y0) return null;

  return {
    left: x0 * scaleX,
    top: y0 * scaleY,
    width: (x1 - x0) * scaleX,
    height: (y1 - y0) * scaleY,
  };
}
