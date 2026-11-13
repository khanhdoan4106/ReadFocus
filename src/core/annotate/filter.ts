import { normalizeVietnamese } from '../search';
import type { Annotation, AnnotationColor } from './types';

export type NoteFilter = {
  color: AnnotationColor | 'all';
  query: string;
  ignoreDiacritics: boolean;
};

function haystack(annotation: Annotation): string {
  const quote = annotation.anchor.type === 'text' ? annotation.anchor.quote : '';
  return `${annotation.note}\n${quote}`;
}

/** Lọc theo màu và tìm trong ghi chú lẫn đoạn trích (có dấu hoặc không dấu). */
export function filterAnnotations(items: readonly Annotation[], filter: NoteFilter): Annotation[] {
  const query = filter.query.trim();
  const needle = filter.ignoreDiacritics
    ? normalizeVietnamese(query)
    : query.normalize('NFC').toLocaleLowerCase('vi');
  return items.filter((item) => {
    if (filter.color !== 'all' && item.color !== filter.color) return false;
    if (needle === '') return true;
    const text = haystack(item);
    const target = filter.ignoreDiacritics
      ? normalizeVietnamese(text)
      : text.normalize('NFC').toLocaleLowerCase('vi');
    return target.includes(needle);
  });
}

/** Nhóm theo trang, giữ thứ tự trang tăng dần. */
export function groupByPage(items: readonly Annotation[]): Array<[number, Annotation[]]> {
  const map = new Map<number, Annotation[]>();
  for (const item of [...items].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)) {
    map.set(item.page, [...(map.get(item.page) ?? []), item]);
  }
  return [...map.entries()];
}
