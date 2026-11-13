// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reflowRects } from '../src/viewer/text-layer-rects';

/** Dựng text layer giả: mỗi span rộng 100px, cao 10px, một dòng một span, trang 400x400 ở (10, 20). */
function build(spanTexts: string[]) {
  document.body.innerHTML = '';
  const page = document.createElement('div');
  const layer = document.createElement('div');
  page.append(layer);
  const rows: Record<number, HTMLElement> = {};
  spanTexts.forEach((text, index) => {
    const span = document.createElement('span');
    span.textContent = text;
    layer.append(span);
    rows[index] = span;
  });
  document.body.append(page);
  page.getBoundingClientRect = () =>
    ({ left: 10, top: 20, width: 400, height: 400, right: 410, bottom: 420 }) as DOMRect;
  return { page, layer, rows };
}

beforeEach(() => {
  // Mỗi Range trả một rect: theo tỉ lệ ký tự trong span (đủ để kiểm tra chọn đúng đoạn).
  vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    const node = this.startContainer;
    const span = node.parentElement as HTMLElement;
    const index = Array.from(span.parentElement!.children).indexOf(span);
    const length = node.textContent?.length ?? 1;
    const width = (100 * (this.endOffset - this.startOffset)) / length;
    const left = 10 + (100 * this.startOffset) / length;
    return [{ left, top: 20 + index * 20, width, height: 10 }] as unknown as DOMRectList;
  });
});
afterEach(() => vi.restoreAllMocks());

describe('reflowRects', () => {
  it('đoạn trong một span: rect chuẩn hóa 0..1 theo trang', () => {
    const { page, layer } = build(['abcdefghij']);
    const rects = reflowRects(layer, page, 'abcdefghij', 2, 6);
    expect(rects).toHaveLength(1);
    expect(rects?.[0]?.x).toBeCloseTo(0.2 * 0.25); // (10 + 20) - 10 = 20px / 400
    expect(rects?.[0]?.w).toBeCloseTo(40 / 400);
    expect(rects?.[0]?.y).toBeCloseTo(0);
    expect(rects?.[0]?.h).toBeCloseTo(10 / 400);
  });

  it('trải nhiều span (nhiều dòng): mỗi dòng một rect', () => {
    const { page, layer } = build(['Dòng một', 'dòng hai']);
    const text = 'Dòng một\ndòng hai';
    const rects = reflowRects(layer, page, text, text.indexOf('một'), text.length);
    expect(rects).toHaveLength(2);
    expect(rects?.[1]?.y).toBeCloseTo(20 / 400);
  });

  it('ánh xạ thất bại hoặc offset ngoài phạm vi: null (không vẽ rect cũ)', () => {
    const { page, layer } = build(['hoàn toàn khác']);
    expect(reflowRects(layer, page, 'Xác suất đo', 0, 5)).toBeNull();
    expect(reflowRects(layer, page, 'Xác suất đo', 0, 999)).toBeNull();
  });

  it('text layer chưa có chữ: null', () => {
    const { page, layer } = build([]);
    expect(reflowRects(layer, page, 'Xác suất', 0, 4)).toBeNull();
  });

  it('trình duyệt không trả rect (hoặc trang kích thước 0): null', () => {
    const { page, layer } = build(['abcdef']);
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([] as unknown as DOMRectList);
    expect(reflowRects(layer, page, 'abcdef', 0, 3)).toBeNull();
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    expect(reflowRects(layer, page, 'abcdef', 0, 3)).toBeNull();
  });

  it('bỏ qua span bọc markedContent', () => {
    const { page, layer } = build(['abcdef']);
    const wrapper = document.createElement('span');
    wrapper.className = 'markedContent';
    layer.prepend(wrapper);
    expect(reflowRects(layer, page, 'abcdef', 0, 3)).toHaveLength(1);
  });
});
