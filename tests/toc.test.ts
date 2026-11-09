import { describe, expect, it } from 'vitest';
import { buildToc, type TocLine, type TocPage } from '../src/core/toc';

const BODY = 'nội dung thân bài bình thường với nhiều chữ để chiếm ưu thế cỡ chữ';

function line(text: string, fontSize = 12, bold = false): TocLine {
  return { text, fontSize, bold };
}

function page(pageNumber: number, lines: TocLine[], text = ''): TocPage {
  return {
    page: pageNumber,
    text,
    lines,
    width: 612,
    height: 792,
  };
}

function pagesWithBody(count: number): TocPage[] {
  return Array.from({ length: count }, (_, index) =>
    page(index + 1, [line(`${index + 1}`), line(`${BODY} ${index}`)], `${BODY} ${index}`),
  );
}

describe('buildToc — outline', () => {
  it('dùng outline và điền trang kết thúc, số từ', () => {
    const pages = pagesWithBody(10).map((item) => ({
      ...item,
      text: 'một hai ba bốn năm',
    }));

    const result = buildToc({
      pages,
      outline: [
        { title: 'Chương 1', startPage: 1, level: 1 },
        { title: 'Chương 2', startPage: 6, level: 1 },
      ],
    });

    expect(result.source).toBe('outline');
    expect(result.items).toEqual([
      { title: 'Chương 1', startPage: 1, endPage: 5, level: 1, wordCount: 25 },
      { title: 'Chương 2', startPage: 6, endPage: 10, level: 1, wordCount: 25 },
    ]);
  });

  it('bỏ mục rỗng và kẹp trang ngoài tài liệu', () => {
    const result = buildToc({
      pages: pagesWithBody(3),
      outline: [
        { title: '  ', startPage: 1, level: 1 },
        { title: 'Mở đầu', startPage: 0, level: 0 },
        { title: 'Kết', startPage: 99, level: 9 },
      ],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ title: 'Mở đầu', startPage: 1, level: 1 });
    expect(result.items[1]).toMatchObject({ title: 'Kết', startPage: 3, level: 6 });
  });

  it('ưu tiên outline hơn heuristic tiêu đề', () => {
    const pages = [page(1, [line('Chương 1 Mở đầu', 24)]), page(2, [line(BODY)])];
    const result = buildToc({
      pages,
      outline: [{ title: 'Từ outline', startPage: 1, level: 1 }],
    });
    expect(result.source).toBe('outline');
    expect(result.items[0]?.title).toBe('Từ outline');
  });
});

describe('buildToc — heuristic tiêu đề', () => {
  it('nhận tiêu đề lớn khớp mẫu Chương/Chapter hoặc số thứ tự', () => {
    const pages = pagesWithBody(10);
    pages[0] = page(1, [line('Chương 1 Mở đầu', 24), line(BODY)]);
    pages[4] = page(5, [line('2. Phương pháp', 20), line(BODY)]);
    pages[7] = page(8, [line('2.1 Khảo sát', 18), line(BODY)]);

    const result = buildToc({ pages });

    expect(result.source).toBe('headings');
    expect(result.items.map((item) => item.title)).toEqual([
      'Chương 1 Mở đầu',
      '2. Phương pháp',
      '2.1 Khảo sát',
    ]);
    expect(result.items.map((item) => item.level)).toEqual([1, 1, 2]);
    expect(result.items.map((item) => item.startPage)).toEqual([1, 5, 8]);
  });

  it('nhận tiêu đề in đậm cùng cỡ chữ thân bài', () => {
    const pages = pagesWithBody(5);
    pages[1] = page(2, [line('Phần 1: Khởi động', 13, true), line(BODY)]);
    const result = buildToc({ pages });
    expect(result.items.map((item) => item.title)).toContain('Phần 1: Khởi động');
  });

  it('bỏ qua dòng dài hoặc không khớp mẫu', () => {
    const pages = pagesWithBody(6);
    pages[0] = page(1, [
      line('Chương 1 Mở đầu', 24),
      line('1. Một tiêu đề rất dài với nhiều từ hơn giới hạn cho phép của heuristic', 24),
      line('Introduction', 24),
      line(BODY),
    ]);

    const result = buildToc({ pages });
    expect(result.items.map((item) => item.title)).toEqual(['Chương 1 Mở đầu']);
  });

  it('rơi xuống chia mỗi 10 trang khi không tìm được tiêu đề', () => {
    const result = buildToc({ pages: pagesWithBody(25) });

    expect(result.source).toBe('pages');
    expect(result.items).toHaveLength(3);
    expect(result.items.map(({ startPage, endPage }) => [startPage, endPage])).toEqual([
      [1, 10],
      [11, 20],
      [21, 25],
    ]);
    expect(result.items.every((item) => item.title === '')).toBe(true);
  });
});

describe('buildToc — slide', () => {
  it('gom các slide liên tiếp cùng chủ đề', () => {
    const pages = [
      page(1, [line('Ôn tập (1)', 28), line('tóm tắt nhanh')]),
      page(2, [line('Ôn tập (2)', 28), line('bài tập')]),
      page(3, [line('Thực hành', 28), line('làm việc nhóm')]),
      page(4, [line('Thực hành - 2', 28), line('trình bày')]),
    ];

    const result = buildToc({ pages, kind: 'slides' });

    expect(result.source).toBe('slides');
    expect(result.items.map((item) => item.title)).toEqual(['Ôn tập (1)', 'Thực hành']);
    expect(result.items.map(({ startPage, endPage }) => [startPage, endPage])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('không dùng tầng slide cho tài liệu không phải slide', () => {
    const pages = pagesWithBody(12);
    const result = buildToc({ pages, kind: 'book' });
    expect(result.source).toBe('pages');
  });
});

describe('buildToc — nhiều trang hơn dữ liệu đã trích', () => {
  it('dùng pageCount để chia đủ tài liệu', () => {
    const result = buildToc({ pages: pagesWithBody(10), pageCount: 23 });
    expect(result.items.map(({ startPage, endPage }) => [startPage, endPage])).toEqual([
      [1, 10],
      [11, 20],
      [21, 23],
    ]);
  });
});
