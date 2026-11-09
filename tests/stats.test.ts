import { describe, expect, it } from 'vitest';
import {
  addReading,
  emptyDayStats,
  localDateKey,
  sanitizeDayStats,
  totalReading,
} from '../src/core/stats';

describe('localDateKey', () => {
  it('dùng ngày địa phương dạng YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31');
  });
});

describe('emptyDayStats', () => {
  it('bắt đầu từ 0 phút và 0 trang', () => {
    expect(emptyDayStats('2026-02-03')).toEqual({ date: '2026-02-03', minutes: 0, pages: 0 });
  });
});

describe('addReading', () => {
  it('cộng phút và trang trong ngày', () => {
    const day = addReading(emptyDayStats('2026-02-03'), 4.5, 3);
    expect(day).toEqual({ date: '2026-02-03', minutes: 4.5, pages: 3 });
  });

  it('bỏ qua số âm hoặc không hợp lệ', () => {
    expect(addReading(emptyDayStats('2026-02-03'), -2, -1)).toEqual({
      date: '2026-02-03',
      minutes: 0,
      pages: 0,
    });
    expect(addReading(emptyDayStats('2026-02-03'), Number.NaN, Number.NaN).minutes).toBe(0);
  });

  it('làm tròn số trang', () => {
    expect(addReading(emptyDayStats('2026-02-03'), 1, 2.6).pages).toBe(3);
  });
});

describe('sanitizeDayStats', () => {
  it('nhận dữ liệu hợp lệ', () => {
    expect(sanitizeDayStats({ date: '2026-02-03', minutes: 12, pages: 7 })).toEqual({
      date: '2026-02-03',
      minutes: 12,
      pages: 7,
    });
  });

  it('từ chối dữ liệu hỏng', () => {
    expect(sanitizeDayStats(null)).toBeNull();
    expect(sanitizeDayStats('2026-02-03')).toBeNull();
    expect(sanitizeDayStats({ date: '3/2/2026', minutes: 1 })).toBeNull();
  });

  it('đưa số âm về 0 thay vì báo lỗi', () => {
    expect(sanitizeDayStats({ date: '2026-02-03', minutes: -5, pages: -2 })).toEqual({
      date: '2026-02-03',
      minutes: 0,
      pages: 0,
    });
  });
});

describe('totalReading', () => {
  it('cộng dồn nhiều ngày', () => {
    expect(
      totalReading([
        { date: '2026-02-01', minutes: 10, pages: 4 },
        { date: '2026-02-02', minutes: 5, pages: 2 },
      ]),
    ).toEqual({ minutes: 15, pages: 6 });
  });

  it('trả 0 khi chưa có dữ liệu', () => {
    expect(totalReading([])).toEqual({ minutes: 0, pages: 0 });
  });
});
