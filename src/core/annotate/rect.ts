import type { Rect } from './types';

export type Size = { width: number; height: number };

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Đổi rect theo điểm ảnh của trang (ở mức zoom bất kỳ) sang tọa độ chuẩn hóa 0..1. */
export function normalizeRect(rect: Rect, page: Size): Rect {
  if (page.width <= 0 || page.height <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x = clamp01(rect.x / page.width);
  const y = clamp01(rect.y / page.height);
  const right = clamp01((rect.x + rect.w) / page.width);
  const bottom = clamp01((rect.y + rect.h) / page.height);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** Đổi rect chuẩn hóa sang điểm ảnh ở kích thước trang hiện tại. */
export function denormalizeRect(rect: Rect, page: Size): Rect {
  return {
    x: rect.x * page.width,
    y: rect.y * page.height,
    w: rect.w * page.width,
    h: rect.h * page.height,
  };
}

export function isValidRect(value: unknown): value is Rect {
  if (typeof value !== 'object' || value === null) return false;
  const rect = value as Record<string, unknown>;
  return (['x', 'y', 'w', 'h'] as const).every((key) => {
    const n = rect[key];
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  });
}

/**
 * Gộp các rect nằm cùng dòng và chạm hoặc gần nhau (DOM trả nhiều rect cho một dòng vì chữ
 * bị tách thành nhiều span), để highlight liền mạch và bản ghi gọn.
 */
export function mergeLineRects(rects: readonly Rect[], gap = 0.004): Rect[] {
  const sorted = rects
    .filter((rect) => rect.w > 0 && rect.h > 0)
    .map((rect) => ({ ...rect }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: Rect[] = [];
  for (const rect of sorted) {
    const last = merged[merged.length - 1];
    if (last) {
      const overlap = Math.min(last.y + last.h, rect.y + rect.h) - Math.max(last.y, rect.y);
      const sameLine = overlap > 0.5 * Math.min(last.h, rect.h);
      if (sameLine && rect.x <= last.x + last.w + gap) {
        const top = Math.min(last.y, rect.y);
        const bottom = Math.max(last.y + last.h, rect.y + rect.h);
        const right = Math.max(last.x + last.w, rect.x + rect.w);
        last.x = Math.min(last.x, rect.x);
        last.y = top;
        last.w = right - last.x;
        last.h = bottom - top;
        continue;
      }
    }
    merged.push(rect);
  }
  return merged;
}
