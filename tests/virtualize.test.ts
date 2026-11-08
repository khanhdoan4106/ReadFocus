import { describe, expect, it } from 'vitest';
import { computeVisiblePages, type PageOffset } from '../src/core/virtualize';

const pages: PageOffset[] = Array.from({ length: 10 }, (_, index) => ({
  page: index + 1,
  top: index * 1000,
  height: 1000,
}));

describe('computeVisiblePages', () => {
  it('trả về rỗng khi chưa có trang', () => {
    expect(computeVisiblePages([], 0, 600)).toEqual({ active: [], current: 1 });
  });

  it('ở đầu tài liệu thì render trang đầu và một trang kế', () => {
    const result = computeVisiblePages(pages, 0, 600);
    expect(result.current).toBe(1);
    expect(result.active).toEqual([1, 2]);
  });

  it('render thêm một màn hình mỗi phía', () => {
    const result = computeVisiblePages(pages, 4000, 600);
    expect(result.active).toEqual([4, 5, 6]);
    expect(result.current).toBe(5);
  });

  it('tôn trọng marginFactor bằng 0', () => {
    const result = computeVisiblePages(pages, 4000, 600, 0);
    expect(result.active).toEqual([4, 5]);
  });

  it('ở cuối tài liệu vẫn giữ trang cuối là trang hiện tại', () => {
    const result = computeVisiblePages(pages, 9000, 600);
    expect(result.current).toBe(10);
    expect(result.active).toEqual([9, 10]);
  });

  it('chịu được trang cao thấp khác nhau', () => {
    const mixed: PageOffset[] = [
      { page: 1, top: 0, height: 300 },
      { page: 2, top: 320, height: 2000 },
      { page: 3, top: 2340, height: 300 },
    ];
    const result = computeVisiblePages(mixed, 2350, 400, 0);
    expect(result.active).toEqual([3]);
    expect(result.current).toBe(3);
  });
});
