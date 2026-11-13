import { describe, expect, it } from 'vitest';
import { resolveTextAnchor } from '../src/core/annotate/anchor';
import { boundingRect, locateSelection } from '../src/core/annotate/locate';

const PAGE =
  'Mở đầu. Giá trị kỳ vọng là gì?\nGiá trị kỳ vọng của xúc xắc. Kết luận: giá trị kỳ vọng.';

describe('locateSelection', () => {
  it('tìm đoạn chọn dù text layer ngắt dòng khác văn bản đã trích', () => {
    const anchor = locateSelection(PAGE, 'là gì?  Giá trị', 0.3, []);
    expect(anchor?.quote).toBe('là gì?\nGiá trị');
    expect(resolveTextAnchor(anchor!, PAGE).status).toBe('ok');
  });

  it('nhiều chỗ khớp: chọn chỗ có vị trí tương đối gần nhất', () => {
    const last = locateSelection(PAGE, 'giá trị kỳ vọng', 0.9, []);
    expect(last?.start).toBe(PAGE.lastIndexOf('giá trị'));

    const early = locateSelection(PAGE, 'Giá trị kỳ vọng', 0.1, []);
    const late = locateSelection(PAGE, 'Giá trị kỳ vọng', 0.6, []);
    expect(early?.start).toBe(PAGE.indexOf('Giá trị'));
    expect(late?.start).toBe(PAGE.indexOf('Giá trị', PAGE.indexOf('Giá trị') + 1));
  });

  it('không tìm thấy hoặc chỉ khoảng trắng thì null (chuyển sang highlight vùng)', () => {
    expect(locateSelection(PAGE, 'không có trong trang', 0.5, [])).toBeNull();
    expect(locateSelection(PAGE, '   ', 0.5, [])).toBeNull();
  });

  it('giữ rect đã chuẩn hóa trong neo', () => {
    const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.02 };
    expect(locateSelection(PAGE, 'Mở đầu', 0, [rect])?.rects).toEqual([rect]);
  });
});

describe('boundingRect', () => {
  it('bao quanh mọi rect; rỗng thì null', () => {
    expect(boundingRect([])).toBeNull();
    const box = boundingRect([
      { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
      { x: 0.2, y: 0.3, w: 0.4, h: 0.1 },
    ]);
    expect(box?.x).toBeCloseTo(0.1);
    expect(box?.y).toBeCloseTo(0.1);
    expect(box?.w).toBeCloseTo(0.5);
    expect(box?.h).toBeCloseTo(0.3);
  });
});
