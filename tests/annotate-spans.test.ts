import { describe, expect, it } from 'vitest';
import { mapRangeToSpans } from '../src/core/annotate/spans';

function slice(spans: readonly string[], segments: ReturnType<typeof mapRangeToSpans>): string[] {
  return (segments ?? []).map((s) => (spans[s.span] as string).slice(s.from, s.to));
}

describe('mapRangeToSpans', () => {
  it('đoạn nằm trong một span', () => {
    const spans = ['Xác suất đo mức độ', ' chắc chắn'];
    const page = 'Xác suất đo mức độ chắc chắn';
    const start = page.indexOf('suất');
    const result = mapRangeToSpans(spans, page, start, start + 4);
    expect(result).toEqual([{ span: 0, from: 4, to: 8 }]);
    expect(slice(spans, result)).toEqual(['suất']);
  });

  it('trải nhiều span, span giữa lấy trọn, hai đầu lấy một phần', () => {
    const spans = ['Phân phối', ' chuẩn', ' xuất hiện', ' ở khắp nơi'];
    const page = 'Phân phối chuẩn xuất hiện ở khắp nơi';
    const start = page.indexOf('phối');
    const end = page.indexOf('hiện') + 4;
    const result = mapRangeToSpans(spans, page, start, end);
    expect(result?.map((s) => s.span)).toEqual([0, 1, 2]);
    expect(slice(spans, result).join('').replace(/\s+/g, '')).toBe('phốichuẩnxuấthiện');
  });

  it('văn bản trích có xuống dòng và dấu cách nhưng text layer thì không', () => {
    const spans = ['Dòng một', 'dòng hai', 'dòng ba'];
    const page = 'Dòng một\ndòng hai\n\ndòng ba';
    const start = page.indexOf('một');
    const end = page.indexOf('hai') + 3;
    const result = mapRangeToSpans(spans, page, start, end);
    expect(slice(spans, result)).toEqual(['một', 'dòng hai']);
  });

  it('chữ tiếng Việt dạng NFD trên text layer, NFC trong văn bản trích', () => {
    const page = 'Giá trị kỳ vọng của xúc xắc';
    const spans = [page.slice(0, 10).normalize('NFD'), page.slice(10).normalize('NFD')];
    const start = page.indexOf('kỳ vọng');
    const result = mapRangeToSpans(spans, page, start, start + 'kỳ vọng'.length);
    expect(result).not.toBeNull();
    const text = slice(spans, result).join('');
    expect(text.normalize('NFC').replace(/\s+/g, '')).toBe('kỳvọng');
  });

  it('chữ lặp lại: chọn chỗ gần vị trí cũ nhất', () => {
    const spans = ['abc xyz ', 'abc xyz ', 'abc xyz'];
    const page = 'abc xyz abc xyz abc xyz';
    const second = page.indexOf('abc', 4);
    const result = mapRangeToSpans(spans, page, second, second + 3);
    expect(result).toEqual([{ span: 1, from: 0, to: 3 }]);
    const third = page.lastIndexOf('abc');
    expect(mapRangeToSpans(spans, page, third, third + 3)).toEqual([{ span: 2, from: 0, to: 3 }]);
  });

  it.each([
    ['start âm', -1, 3],
    ['end vượt độ dài', 0, 999],
    ['end <= start', 5, 5],
    ['không phải số nguyên', 0.5, 3],
  ])('offset ngoài phạm vi (%s) trả null', (_name, start, end) => {
    expect(mapRangeToSpans(['abcdef'], 'abcdef', start, end)).toBeNull();
  });

  it('text layer không có chữ đó thì thất bại (null), không đoán', () => {
    expect(mapRangeToSpans(['hoàn toàn khác'], 'Xác suất đo', 0, 5)).toBeNull();
    expect(mapRangeToSpans([], 'Xác suất đo', 0, 5)).toBeNull();
  });

  it('khoảng chỉ có khoảng trắng thì null', () => {
    expect(mapRangeToSpans(['a  b'], 'a  b', 1, 3)).toBeNull();
  });
});
