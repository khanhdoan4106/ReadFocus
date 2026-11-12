import type { DocumentProfile } from '../../core/profile';

/** Trạng thái lập chỉ mục (trích văn bản, phân loại) của tài liệu đang mở. */
export type Analysis =
  | { phase: 'idle' }
  | { phase: 'extracting'; done: number; total: number }
  | { phase: 'done'; profile: DocumentProfile }
  | { phase: 'error' };

export type IndexRange = {
  from: string;
  to: string;
};
