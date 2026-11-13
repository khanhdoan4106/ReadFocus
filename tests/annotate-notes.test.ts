import { describe, expect, it } from 'vitest';
import { filterAnnotations, groupByPage } from '../src/core/annotate/filter';
import { draftFromAnnotation } from '../src/core/annotate/flashcard';
import { createAnnotation } from '../src/core/annotate/record';
import type { Annotation, AnnotationColor } from '../src/core/annotate/types';
import { sanitizeCard } from '../src/core/flashcard/leitner';
import { newCard } from '../src/core/flashcard/from-summary';

function text(
  id: string,
  page: number,
  quote: string,
  note = '',
  color: AnnotationColor = 'yellow',
) {
  return createAnnotation(
    {
      docId: 'd',
      page,
      color,
      note,
      anchor: {
        type: 'text',
        start: 0,
        end: quote.length,
        quote,
        prefix: '',
        suffix: '',
        rects: [],
      },
    },
    { uuid: () => id, now: () => page * 10 },
  );
}

const ITEMS: Annotation[] = [
  text('a', 3, 'Phân phối chuẩn xuất hiện ở khắp nơi', 'Nhớ công thức', 'green'),
  text('b', 1, 'Xác suất đo mức độ chắc chắn', '', 'yellow'),
  createAnnotation(
    { docId: 'd', page: 3, anchor: { type: 'page' }, note: 'Đọc lại trang' },
    { uuid: () => 'c' },
  ),
];

describe('filterAnnotations', () => {
  const base = { color: 'all', query: '', ignoreDiacritics: true } as const;

  it('không lọc thì giữ nguyên', () => {
    expect(filterAnnotations(ITEMS, base)).toHaveLength(3);
  });

  it('lọc theo màu', () => {
    expect(filterAnnotations(ITEMS, { ...base, color: 'green' }).map((x) => x.id)).toEqual(['a']);
    expect(filterAnnotations(ITEMS, { ...base, color: 'blue' })).toEqual([]);
  });

  it('tìm không dấu trong cả ghi chú và đoạn trích', () => {
    expect(filterAnnotations(ITEMS, { ...base, query: 'xac suat' }).map((x) => x.id)).toEqual([
      'b',
    ]);
    expect(filterAnnotations(ITEMS, { ...base, query: 'CONG THUC' }).map((x) => x.id)).toEqual([
      'a',
    ]);
    expect(filterAnnotations(ITEMS, { ...base, query: 'doc lai' }).map((x) => x.id)).toEqual(['c']);
  });

  it('tìm có dấu thì phân biệt dấu', () => {
    const strict = { ...base, ignoreDiacritics: false };
    expect(filterAnnotations(ITEMS, { ...strict, query: 'xác suất' }).map((x) => x.id)).toEqual([
      'b',
    ]);
    expect(filterAnnotations(ITEMS, { ...strict, query: 'xac suat' })).toEqual([]);
  });

  it('kết hợp màu và từ khoá', () => {
    expect(filterAnnotations(ITEMS, { ...base, color: 'yellow', query: 'cong thuc' })).toEqual([]);
  });
});

describe('groupByPage', () => {
  it('nhóm theo trang tăng dần', () => {
    const groups = groupByPage(ITEMS);
    expect(groups.map(([page, list]) => [page, list.map((x) => x.id)])).toEqual([
      [1, ['b']],
      [3, ['a', 'c']],
    ]);
  });
});

describe('draftFromAnnotation', () => {
  it('có ghi chú: mặt trước là ghi chú, mặt sau là trích dẫn', () => {
    const draft = draftFromAnnotation(ITEMS[0] as Annotation);
    expect(draft).toEqual({
      front: 'Nhớ công thức',
      back: 'Phân phối chuẩn xuất hiện ở khắp nơi',
      page: 3,
      source: 'note',
    });
  });

  it('không ghi chú, câu tiếng Anh: che từ dài nhất', () => {
    const draft = draftFromAnnotation(text('e', 2, 'Attention is scarce before interest'));
    expect(draft?.front).toContain('_____');
    expect(draft?.back).toContain('Attention is scarce before interest');
    expect(draft?.page).toBe(2);
  });

  it('không ghi chú, câu tiếng Việt: không che được nên trả null (nhắc thêm ghi chú)', () => {
    expect(draftFromAnnotation(ITEMS[1] as Annotation)).toBeNull();
  });

  it('highlight vùng và ghi chú trang không tạo thẻ', () => {
    expect(draftFromAnnotation(ITEMS[2] as Annotation)).toBeNull();
    const area = createAnnotation({
      docId: 'd',
      page: 1,
      note: 'x',
      anchor: { type: 'area', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
    });
    expect(draftFromAnnotation(area)).toBeNull();
  });

  it('thẻ tạo từ ghi chú qua được newCard và sanitizeCard giữ nguồn "note"', () => {
    const draft = draftFromAnnotation(ITEMS[0] as Annotation)!;
    const card = newCard('d', draft, '2026-11-13', 1);
    expect(sanitizeCard(card)?.source).toBe('note');
  });
});
