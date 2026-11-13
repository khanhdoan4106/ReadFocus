import { isValidRect } from './rect';
import {
  ANNOTATION_COLORS,
  type Anchor,
  type Annotation,
  type AnnotationColor,
  type AnnotationKind,
} from './types';

export function isAnnotationColor(value: unknown): value is AnnotationColor {
  return typeof value === 'string' && (ANNOTATION_COLORS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function sanitizeAnchor(raw: unknown): Anchor | null {
  if (!isRecord(raw)) return null;
  if (raw.type === 'page') return { type: 'page' };
  if (raw.type === 'area') {
    return isValidRect(raw.rect) ? { type: 'area', rect: { ...raw.rect } } : null;
  }
  if (raw.type === 'text') {
    const { start, end, quote, prefix, suffix, rects } = raw;
    if (!isCount(start) || !isCount(end) || end <= start) return null;
    if (typeof quote !== 'string' || quote.trim() === '') return null;
    if (typeof prefix !== 'string' || typeof suffix !== 'string') return null;
    if (!Array.isArray(rects) || !rects.every(isValidRect)) return null;
    return {
      type: 'text',
      start,
      end,
      quote,
      prefix,
      suffix,
      rects: rects.map((rect) => ({ ...rect })),
    };
  }
  return null;
}

/**
 * Kiểm tra và chuẩn hóa một bản ghi đọc từ IndexedDB hoặc file nhập. Dữ liệu hỏng trả `null`
 * (không đoán sửa): người gọi quyết định bỏ qua hay báo lỗi.
 */
export function sanitizeAnnotation(raw: unknown): Annotation | null {
  if (!isRecord(raw)) return null;
  const { id, docId, page, kind, color, note, createdAt, updatedAt } = raw;
  if (typeof id !== 'string' || id === '' || typeof docId !== 'string' || docId === '') return null;
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) return null;
  if (kind !== 'text' && kind !== 'area' && kind !== 'page') return null;
  if (!isAnnotationColor(color)) return null;
  if (typeof note !== 'string') return null;
  if (!isCount(createdAt) || !isCount(updatedAt)) return null;
  const anchor = sanitizeAnchor(raw.anchor);
  if (anchor === null || anchor.type !== kind) return null;
  return { id, docId, page, kind, color, anchor, note, createdAt, updatedAt };
}

export type NewAnnotationInput = {
  docId: string;
  page: number;
  anchor: Anchor;
  color?: AnnotationColor;
  note?: string;
};

export type AnnotationEnv = { now?: () => number; uuid?: () => string };

export function createAnnotation(input: NewAnnotationInput, env: AnnotationEnv = {}): Annotation {
  const now = (env.now ?? Date.now)();
  const kind: AnnotationKind = input.anchor.type;
  return {
    id: (env.uuid ?? (() => crypto.randomUUID()))(),
    docId: input.docId,
    page: input.page,
    kind,
    color: input.color ?? 'yellow',
    anchor: input.anchor,
    note: input.note ?? '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Sửa màu hoặc ghi chú; `updatedAt` tăng để việc nhập/gộp biết bản nào mới hơn. */
export function updateAnnotation(
  annotation: Annotation,
  changes: { color?: AnnotationColor; note?: string; anchor?: Anchor },
  now: () => number = Date.now,
): Annotation {
  const anchor = changes.anchor ?? annotation.anchor;
  return {
    ...annotation,
    color: changes.color ?? annotation.color,
    note: changes.note ?? annotation.note,
    anchor,
    kind: anchor.type,
    updatedAt: Math.max(now(), annotation.updatedAt + 1),
  };
}
