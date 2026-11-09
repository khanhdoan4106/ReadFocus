import { describe, expect, it } from 'vitest';
import {
  buildSearchIndex,
  makeSnippet,
  matchesQuery,
  normalizeVietnamese,
  searchIndex,
  splitParagraphs,
} from '../src/core/search';

describe('normalizeVietnamese', () => {
  it('bỏ dấu và đổi đ thành d', () => {
    expect(normalizeVietnamese('Chương Đọc Sách')).toBe('chuong doc sach');
    expect(normalizeVietnamese('Tóm tắt, tài liệu tham khảo')).toBe('tom tat, tai lieu tham khao');
  });

  it('gộp khoảng trắng và lowercase', () => {
    expect(normalizeVietnamese('  ĐỌC   NHANH ')).toBe('doc nhanh');
  });
});

describe('splitParagraphs', () => {
  it('tách theo dòng trống', () => {
    expect(splitParagraphs('Đoạn một.\n\nĐoạn hai.')).toEqual(['Đoạn một.', 'Đoạn hai.']);
  });

  it('gộp dòng đơn và cắt đoạn dài theo giới hạn ký tự', () => {
    const text = Array.from({ length: 20 }, (_, index) => `từ${index}`).join('\n');
    const paragraphs = splitParagraphs(text, 30);
    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs.every((paragraph) => paragraph.length <= 30)).toBe(true);
    expect(paragraphs.join(' ')).toBe(
      Array.from({ length: 20 }, (_, index) => `từ${index}`).join(' '),
    );
  });

  it('bỏ văn bản rỗng', () => {
    expect(splitParagraphs('   \n\n  ')).toEqual([]);
  });
});

describe('searchIndex', () => {
  const pages = [
    { page: 1, text: 'Chương 1: Đọc nhanh và tập trung hơn khi đọc tài liệu dài.' },
    { page: 2, text: 'Phương pháp đọc hiệu quả gồm tóm tắt và ghi chú.' },
    { page: 3, text: 'Tài liệu tham khảo về đọc sách.' },
  ];

  it('tìm có dấu và trả số trang', () => {
    const index = buildSearchIndex(pages);
    const hits = searchIndex(index, 'đọc', { ignoreDiacritics: false });
    expect(hits.map((hit) => hit.page).sort()).toEqual([1, 2, 3]);
    expect(hits.some((hit) => hit.snippet.includes('Đọc'))).toBe(true);
  });

  it('tìm không dấu khớp cả chương và đ', () => {
    const index = buildSearchIndex(pages);
    const hits = searchIndex(index, 'chuong', { ignoreDiacritics: true });
    expect(hits.map((hit) => hit.page)).toEqual([1]);
    expect(hits[0]?.snippet).toContain('Chương');
  });

  it('tìm có dấu không khớp từ không dấu', () => {
    const index = buildSearchIndex(pages);
    expect(searchIndex(index, 'chuong', { ignoreDiacritics: false })).toEqual([]);
  });

  it('trả rỗng với từ khoá rỗng', () => {
    const index = buildSearchIndex(pages);
    expect(searchIndex(index, '   ', { ignoreDiacritics: true })).toEqual([]);
  });

  it('tôn trọng giới hạn kết quả', () => {
    const index = buildSearchIndex([
      { page: 1, text: 'đọc sách' },
      { page: 2, text: 'đọc báo' },
      { page: 3, text: 'đọc tạp chí' },
    ]);
    expect(searchIndex(index, 'đọc', { ignoreDiacritics: true, limit: 2 })).toHaveLength(2);
  });
});

describe('matchesQuery', () => {
  it('so khớp có hoặc không dấu', () => {
    expect(matchesQuery('Chương 1', 'chuong', true)).toBe(true);
    expect(matchesQuery('Chương 1', 'chuong', false)).toBe(false);
    expect(matchesQuery('Chương 1', 'CHƯƠNG', false)).toBe(true);
  });

  it('trả false với từ khoá rỗng', () => {
    expect(matchesQuery('Chương 1', '  ', true)).toBe(false);
  });
});

describe('makeSnippet', () => {
  const text = Array.from({ length: 40 }, (_, index) => `từ${index}`).join(' ');

  it('cắt cửa sổ quanh chỗ khớp và thêm dấu ba chấm', () => {
    const snippet = makeSnippet(text, ['từ20'], false);
    expect(snippet.startsWith('… ')).toBe(true);
    expect(snippet.endsWith(' …')).toBe(true);
    expect(snippet).toContain('từ20');
  });

  it('không cắt khi đoạn ngắn', () => {
    expect(makeSnippet('đọc nhanh hơn', ['đọc'], true)).toBe('đọc nhanh hơn');
  });

  it('trả chuỗi rỗng với đoạn rỗng', () => {
    expect(makeSnippet('   ', ['đọc'], true)).toBe('');
  });
});
