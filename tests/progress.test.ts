import { describe, expect, it } from 'vitest';
import { acceptPageReport, canPersistProgress, sanitizeProgress } from '../src/core/progress';

describe('sanitizeProgress', () => {
  it('giữ tiến độ hợp lệ', () => {
    expect(sanitizeProgress({ page: 7, updatedAt: 1234 }, 20)).toEqual({
      page: 7,
      updatedAt: 1234,
    });
  });

  it('kẹp trang ngoài khoảng của tài liệu', () => {
    expect(sanitizeProgress({ page: 0 }, 20)?.page).toBe(1);
    expect(sanitizeProgress({ page: 99 }, 20)?.page).toBe(20);
  });

  it('làm tròn trang lẻ', () => {
    expect(sanitizeProgress({ page: 4.6 }, 20)?.page).toBe(5);
  });

  it('mặc định updatedAt bằng 0 khi thiếu hoặc sai kiểu', () => {
    expect(sanitizeProgress({ page: 3 }, 20)).toEqual({ page: 3, updatedAt: 0 });
    expect(sanitizeProgress({ page: 3, updatedAt: 'hôm qua' }, 20)).toEqual({
      page: 3,
      updatedAt: 0,
    });
  });

  it('trả null với dữ liệu hỏng', () => {
    expect(sanitizeProgress(null, 20)).toBeNull();
    expect(sanitizeProgress('trang 3', 20)).toBeNull();
    expect(sanitizeProgress({}, 20)).toBeNull();
    expect(sanitizeProgress({ page: 'ba' }, 20)).toBeNull();
    expect(sanitizeProgress({ page: Number.NaN }, 20)).toBeNull();
  });

  it('trả null khi tài liệu không có trang nào', () => {
    expect(sanitizeProgress({ page: 2 }, 0)).toBeNull();
    expect(sanitizeProgress({ page: 2 }, Number.NaN)).toBeNull();
  });
});

describe('acceptPageReport', () => {
  it('nhận mọi báo cáo khi không khôi phục', () => {
    expect(acceptPageReport(1, null)).toBe(1);
    expect(acceptPageReport(9, null)).toBe(9);
  });

  it('bỏ qua báo cáo trang 1 khi đang chờ nhảy tới trang khôi phục', () => {
    expect(acceptPageReport(1, 7)).toBeNull();
  });

  it('nhận đúng trang khôi phục', () => {
    expect(acceptPageReport(7, 7)).toBe(7);
  });

  it('chỉ chặn ghi tiến độ trong lúc khôi phục', () => {
    expect(canPersistProgress(7)).toBe(false);
    expect(canPersistProgress(null)).toBe(true);
  });
});
