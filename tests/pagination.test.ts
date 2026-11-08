import { describe, expect, it } from 'vitest';
import { clampPage, fitWidthScale, stepZoom } from '../src/core/pagination';

describe('clampPage', () => {
  it('giữ trang hợp lệ', () => {
    expect(clampPage(5, 10)).toBe(5);
  });

  it('chặn dưới và chặn trên', () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-3, 10)).toBe(1);
    expect(clampPage(99, 10)).toBe(10);
  });

  it('làm tròn số lẻ và xử lý giá trị không hữu hạn', () => {
    expect(clampPage(3.6, 10)).toBe(4);
    expect(clampPage(Number.NaN, 10)).toBe(1);
  });

  it('tài liệu rỗng vẫn trả về trang 1', () => {
    expect(clampPage(4, 0)).toBe(1);
  });
});

describe('stepZoom', () => {
  it('đi lên theo nấc gần nhất', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1.1, 1)).toBe(1.25);
  });

  it('đi xuống theo nấc gần nhất', () => {
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(1.1, -1)).toBe(1);
  });

  it('dừng ở hai đầu', () => {
    expect(stepZoom(3, 1)).toBe(3);
    expect(stepZoom(0.5, -1)).toBe(0.5);
  });
});

describe('fitWidthScale', () => {
  it('vừa đúng chiều rộng khả dụng', () => {
    expect(fitWidthScale(600, 900)).toBe(1.5);
  });

  it('kẹp trong khoảng cho phép', () => {
    expect(fitWidthScale(600, 10)).toBe(0.25);
    expect(fitWidthScale(10, 600)).toBe(4);
  });

  it('trả về 1 khi đầu vào không hợp lệ', () => {
    expect(fitWidthScale(0, 900)).toBe(1);
    expect(fitWidthScale(600, 0)).toBe(1);
  });
});
