import { sanitizeAnnotation } from './record';
import type { Annotation, AnnotationColor } from './types';

/** Phiên bản schema của file JSON xuất/nhập. Tăng khi đổi cấu trúc. */
export const EXPORT_SCHEMA = 'readfocus-annotations';
export const EXPORT_VERSION = 1;

export type ExportedDocument = { id: string; name: string; pageCount: number };

export type AnnotationsFile = {
  schema: typeof EXPORT_SCHEMA;
  version: typeof EXPORT_VERSION;
  exportedAt: number;
  document: ExportedDocument;
  annotations: Annotation[];
};

export function exportAnnotationsJson(
  document: ExportedDocument,
  annotations: readonly Annotation[],
  exportedAt: number = Date.now(),
): string {
  const file: AnnotationsFile = {
    schema: EXPORT_SCHEMA,
    version: EXPORT_VERSION,
    exportedAt,
    document: { id: document.id, name: document.name, pageCount: document.pageCount },
    annotations: annotations.filter((a) => a.docId === document.id),
  };
  return JSON.stringify(file, null, 2);
}

export type ImportError =
  'invalid-json' | 'wrong-schema' | 'wrong-version' | 'invalid-data' | 'other-document';

export type ParsedImport =
  | { ok: true; document: ExportedDocument; annotations: Annotation[] }
  | { ok: false; error: ImportError };

/**
 * Đọc file JSON đã xuất. Tất cả hoặc không gì: một bản ghi hỏng thì cả file bị từ chối,
 * không ghi dở dang. `expectedDocId` (nếu có) chặn nhập ghi chú của tài liệu khác.
 */
export function parseAnnotationsJson(text: string, expectedDocId?: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'wrong-schema' };
  const file = raw as Record<string, unknown>;
  if (file.schema !== EXPORT_SCHEMA) return { ok: false, error: 'wrong-schema' };
  if (file.version !== EXPORT_VERSION) return { ok: false, error: 'wrong-version' };

  const doc = file.document as Record<string, unknown> | null;
  if (
    typeof doc !== 'object' ||
    doc === null ||
    typeof doc.id !== 'string' ||
    doc.id === '' ||
    typeof doc.name !== 'string' ||
    typeof doc.pageCount !== 'number' ||
    !Array.isArray(file.annotations)
  ) {
    return { ok: false, error: 'invalid-data' };
  }
  const document: ExportedDocument = { id: doc.id, name: doc.name, pageCount: doc.pageCount };

  const annotations: Annotation[] = [];
  for (const item of file.annotations) {
    const annotation = sanitizeAnnotation(item);
    if (annotation === null || annotation.docId !== document.id) {
      return { ok: false, error: 'invalid-data' };
    }
    annotations.push(annotation);
  }
  if (expectedDocId !== undefined && document.id !== expectedDocId) {
    return { ok: false, error: 'other-document' };
  }
  return { ok: true, document, annotations };
}

export type MergeResult = {
  /** Danh sách sau khi gộp, gồm cả bản ghi chỉ có ở một phía. */
  merged: Annotation[];
  /** Bản ghi cần ghi xuống DB (mới hoặc thắng bản cũ). */
  toWrite: Annotation[];
  added: number;
  updated: number;
  unchanged: number;
};

/** Gộp theo `id`, giữ bản có `updatedAt` mới hơn; bằng nhau thì giữ bản đang có. */
export function mergeAnnotations(
  existing: readonly Annotation[],
  incoming: readonly Annotation[],
): MergeResult {
  const byId = new Map(existing.map((a) => [a.id, a]));
  const toWrite: Annotation[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of incoming) {
    const current = byId.get(item.id);
    if (current === undefined) {
      byId.set(item.id, item);
      toWrite.push(item);
      added += 1;
    } else if (item.updatedAt > current.updatedAt) {
      byId.set(item.id, item);
      toWrite.push(item);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }
  return { merged: [...byId.values()], toWrite, added, updated, unchanged };
}

export type MarkdownLabels = {
  pageHeading: (page: number) => string;
  pageNote: string;
  area: string;
  note: string;
  color: string;
  colors: Record<AnnotationColor, string>;
};

function quoteBlock(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');
}

/** Xuất Markdown: tiêu đề tài liệu, nhóm theo trang, mỗi mục có trích dẫn, ghi chú và màu. */
export function exportAnnotationsMarkdown(
  title: string,
  annotations: readonly Annotation[],
  labels: MarkdownLabels,
): string {
  const sorted = [...annotations].sort(
    (a, b) =>
      a.page - b.page ||
      (a.anchor.type === 'text' ? a.anchor.start : -1) -
        (b.anchor.type === 'text' ? b.anchor.start : -1) ||
      a.createdAt - b.createdAt,
  );
  const lines: string[] = [`# ${title}`, ''];
  let currentPage = -1;
  for (const item of sorted) {
    if (item.page !== currentPage) {
      currentPage = item.page;
      lines.push(`## ${labels.pageHeading(item.page)}`, '');
    }
    if (item.anchor.type === 'text') lines.push(quoteBlock(item.anchor.quote), '');
    else if (item.anchor.type === 'area') lines.push(`_${labels.area}_`, '');
    else lines.push(`_${labels.pageNote}_`, '');
    if (item.note.trim() !== '') lines.push(`${labels.note}: ${item.note.trim()}`, '');
    lines.push(`_${labels.color}: ${labels.colors[item.color]}_`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
