import { describe, expect, it } from 'vitest';
import type { Rect } from '../src/core/annotate/types';
import { createTextAnchor, resolveTextAnchor } from '../src/core/annotate/anchor';
import { normalizeForMatch, normalizeWithMap } from '../src/core/annotate/normalize';
import {
  denormalizeRect,
  isValidRect,
  mergeLineRects,
  normalizeRect,
} from '../src/core/annotate/rect';

function expectRect(actual: Rect, expected: Rect): void {
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    expect(actual[key]).toBeCloseTo(expected[key], 9);
  }
}

const PAGE =
  'Xác suất đo mức độ chắc chắn của một sự kiện. Biến ngẫu nhiên rời rạc nhận các giá trị đếm được. ' +
  'Phân phối chuẩn xuất hiện ở khắp nơi trong thống kê.';

function anchorOf(text: string, quote: string, from = 0) {
  const start = text.indexOf(quote, from);
  expect(start).toBeGreaterThanOrEqual(0);
  const anchor = createTextAnchor(text, start, start + quote.length);
  expect(anchor).not.toBeNull();
  return anchor!;
}

describe('createTextAnchor', () => {
  it('lưu offset, trích dẫn và ngữ cảnh 32 ký tự', () => {
    const anchor = anchorOf(PAGE, 'Biến ngẫu nhiên rời rạc');
    expect(anchor.quote).toBe('Biến ngẫu nhiên rời rạc');
    expect(anchor.start).toBe(PAGE.indexOf('Biến'));
    expect(anchor.prefix.length).toBeLessThanOrEqual(32);
    expect(anchor.prefix.endsWith('sự kiện. ')).toBe(true);
    expect(anchor.suffix.startsWith(' nhận các')).toBe(true);
  });

  it('cắt khoảng trắng ở hai đầu và từ chối vùng chỉ có khoảng trắng', () => {
    const anchor = createTextAnchor('abc   def', 3, 6);
    expect(anchor).toBeNull();
    const padded = createTextAnchor('abc  def  ', 2, 9)!;
    expect(padded.quote).toBe('c  def');
  });
});

describe('resolveTextAnchor', () => {
  it('đúng chỗ cũ thì ok', () => {
    const anchor = anchorOf(PAGE, 'Phân phối chuẩn');
    expect(resolveTextAnchor(anchor, PAGE)).toEqual({
      status: 'ok',
      start: anchor.start,
      end: anchor.end,
    });
  });

  it('neo lại đúng sau khi lập chỉ mục lại làm đổi khoảng trắng và xuống dòng', () => {
    const anchor = anchorOf(PAGE, 'Biến ngẫu nhiên rời rạc');
    // Trích lại cho ra cùng chữ nhưng dấu cách thành xuống dòng và có khoảng trắng thừa ở đầu.
    const reextracted = `\n  ${PAGE.replace('Biến ngẫu nhiên rời rạc', 'Biến ngẫu\nnhiên  rời rạc')}`;
    const result = resolveTextAnchor(anchor, reextracted);
    expect(result.status).toBe('moved');
    if (result.status !== 'orphan') {
      expect(normalizeForMatch(reextracted.slice(result.start, result.end))).toBe(
        'Biến ngẫu nhiên rời rạc',
      );
    }
  });

  it('quote có dấu tiếng Việt khớp giữa NFC và NFD, trả về offset trong văn bản gốc', () => {
    const anchor = anchorOf(PAGE, 'Xác suất đo mức độ');
    const nfd = PAGE.normalize('NFD');
    const result = resolveTextAnchor(anchor, nfd);
    expect(result.status).toBe('moved');
    if (result.status !== 'orphan') {
      // Cắt theo offset trả về, quay lại NFC, phải đúng nguyên văn.
      expect(nfd.slice(result.start, result.end).normalize('NFC')).toBe('Xác suất đo mức độ');
    }
  });

  it('quote xuất hiện nhiều lần: prefix/suffix chọn đúng chỗ khi nội dung phía trước đổi', () => {
    const text =
      'Định nghĩa. Giá trị kỳ vọng là trung bình có trọng số. ' +
      'Ví dụ. Giá trị kỳ vọng của xúc xắc là 3,5. ' +
      'Bài tập. Giá trị kỳ vọng của tổng hai biến.';
    const second = anchorOf(text, 'Giá trị kỳ vọng', text.indexOf('Ví dụ'));
    // Chèn một đoạn dài ở đầu làm mọi offset lệch; quote vẫn có 3 chỗ khớp.
    const edited = `Lời nói đầu rất dài. ${text}`;
    const result = resolveTextAnchor(second, edited);
    expect(result.status).toBe('moved');
    if (result.status !== 'orphan') {
      expect(edited.slice(result.start - 4, result.start)).toBe('dụ. ');
      expect(edited.slice(result.end, result.end + 18)).toBe(' của xúc xắc là 3,');
    }
  });

  it('hai chỗ khớp ngang nhau về ngữ cảnh thì chọn chỗ gần offset cũ', () => {
    const text = 'abc xyz abc xyz abc xyz';
    const anchor = createTextAnchor(text, 8, 11)!; // abc thứ hai
    const shifted = `${text} `;
    expect(resolveTextAnchor(anchor, shifted)).toMatchObject({ status: 'ok', start: 8 });
    const edited = `ZZ ${text}`; // mọi offset +3, chữ ngữ cảnh vẫn khớp
    expect(resolveTextAnchor(anchor, edited)).toMatchObject({ status: 'moved', start: 11 });
  });

  it('văn bản thay đổi (không còn quote) thì thành mồ côi', () => {
    const anchor = anchorOf(PAGE, 'Biến ngẫu nhiên rời rạc');
    const changed = PAGE.replace('Biến ngẫu nhiên rời rạc', 'Biến ngẫu nhiên liên tục');
    expect(resolveTextAnchor(anchor, changed)).toEqual({ status: 'orphan' });
    expect(resolveTextAnchor(anchor, '')).toEqual({ status: 'orphan' });
  });

  it('trang ngắn hơn offset cũ không làm lỗi', () => {
    const anchor = anchorOf(PAGE, 'Phân phối chuẩn');
    expect(resolveTextAnchor(anchor, 'Phân phối chuẩn')).toMatchObject({
      status: 'moved',
      start: 0,
    });
  });
});

describe('normalizeWithMap', () => {
  it('gộp khoảng trắng và ánh xạ về offset gốc', () => {
    const { text, starts, ends } = normalizeWithMap('a \n\t b');
    expect(text).toBe('a b');
    expect(starts[2]).toBe(5);
    expect(ends[2]).toBe(6);
  });

  it('một ký tự NFD cộng dấu kết hợp là một cụm', () => {
    const source = 'êx'; // ê (NFD) rồi x
    const { text, starts, ends } = normalizeWithMap(source);
    expect(text).toBe('êx');
    expect(starts).toEqual([0, 2]);
    expect(ends).toEqual([2, 3]);
  });
});

describe('rect chuẩn hóa', () => {
  it('đổi mức zoom thì rect vẽ tỉ lệ đúng và quay lại đúng rect chuẩn hóa', () => {
    const at100 = { x: 60, y: 120, w: 300, h: 20 };
    const page100 = { width: 600, height: 800 };
    const stored = normalizeRect(at100, page100);
    expectRect(stored, { x: 0.1, y: 0.15, w: 0.5, h: 0.025 });

    // Zoom 250% rồi 50%: cùng một rect chuẩn hóa vẽ ra đúng kích thước mới.
    const at250 = denormalizeRect(stored, { width: 1500, height: 2000 });
    expectRect(at250, { x: 150, y: 300, w: 750, h: 50 });
    const at50 = denormalizeRect(stored, { width: 300, height: 400 });
    expectRect(at50, { x: 30, y: 60, w: 150, h: 10 });
    expectRect(normalizeRect(at250, { width: 1500, height: 2000 }), stored);
  });

  it('kẹp về 0..1 và chịu được trang kích thước 0', () => {
    expect(normalizeRect({ x: -10, y: 0, w: 5000, h: 10 }, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 0.1,
    });
    expect(normalizeRect({ x: 1, y: 1, w: 1, h: 1 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    });
    expect(isValidRect({ x: 0.1, y: 0.1, w: 2, h: 0.1 })).toBe(false);
  });

  it('mergeLineRects gộp các mẩu cùng dòng và giữ nguyên các dòng khác nhau', () => {
    const merged = mergeLineRects([
      { x: 0.3, y: 0.1, w: 0.1, h: 0.02 },
      { x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
      { x: 0.1, y: 0.14, w: 0.2, h: 0.02 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.x).toBeCloseTo(0.1);
    expect(merged[0]?.w).toBeCloseTo(0.3);
  });
});
