import type { SummaryKeyPoint, SummaryTerm } from './parse';

/**
 * Một kết quả tóm tắt đã lưu. `id` là cache key (băm docId + mục + provider +
 * model + prompt + ngôn ngữ), nên đổi bất kỳ yếu tố nào cũng thành bản mới.
 */
export type SummaryRecord = {
  id: string;
  docId: string;
  startPage: number;
  endPage: number;
  title: string;
  providerId: string;
  model: string;
  promptVersion: number;
  language: string;
  summary: string;
  keyPoints: SummaryKeyPoint[];
  terms: SummaryTerm[];
  createdAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isKeyPoint(value: unknown): value is SummaryKeyPoint {
  if (!isRecord(value) || typeof value.text !== 'string') return false;
  return Array.isArray(value.pages) && value.pages.every((page) => typeof page === 'number');
}

function isTerm(value: unknown): value is SummaryTerm {
  return isRecord(value) && typeof value.term === 'string' && typeof value.definition === 'string';
}

/** Dữ liệu đọc từ IndexedDB có thể do bản cũ ghi; kiểm tra trước khi hiển thị. */
export function sanitizeSummaryRecord(value: unknown): SummaryRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.docId !== 'string') return null;
  if (typeof value.summary !== 'string') return null;
  if (typeof value.startPage !== 'number' || typeof value.endPage !== 'number') return null;

  return {
    id: value.id,
    docId: value.docId,
    startPage: value.startPage,
    endPage: value.endPage,
    title: typeof value.title === 'string' ? value.title : '',
    providerId: typeof value.providerId === 'string' ? value.providerId : '',
    model: typeof value.model === 'string' ? value.model : '',
    promptVersion: typeof value.promptVersion === 'number' ? value.promptVersion : 0,
    language: typeof value.language === 'string' ? value.language : 'vi',
    summary: value.summary,
    keyPoints: Array.isArray(value.keyPoints) ? value.keyPoints.filter(isKeyPoint) : [],
    terms: Array.isArray(value.terms) ? value.terms.filter(isTerm) : [],
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
  };
}
