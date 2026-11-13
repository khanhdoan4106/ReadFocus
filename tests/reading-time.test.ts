import { describe, expect, it } from 'vitest';
import {
  addReadingSample,
  chapterEstimate,
  DEFAULT_WORDS_PER_MINUTE,
  emptyReadingSpeed,
  estimateItemMinutes,
  estimateRemainingTime,
  roundedMinutes,
  sanitizeReadingSpeed,
  wordsPerMinute,
  type TocTimeItem,
} from '../src/core/reading-time';

describe('sanitizeReadingSpeed', () => {
  it('giữ dữ liệu hợp lệ', () => {
    expect(sanitizeReadingSpeed({ activeMs: 120000, words: 400 })).toEqual({
      activeMs: 120000,
      words: 400,
    });
  });

  it('trả về rỗng với dữ liệu hỏng', () => {
    expect(sanitizeReadingSpeed(null)).toEqual(emptyReadingSpeed());
    expect(sanitizeReadingSpeed({ activeMs: -1, words: 10 })).toEqual(emptyReadingSpeed());
    expect(sanitizeReadingSpeed({ activeMs: 1000, words: 'nhiều' })).toEqual(emptyReadingSpeed());
    expect(sanitizeReadingSpeed({ activeMs: Number.NaN, words: 10 })).toEqual(emptyReadingSpeed());
  });
});

describe('addReadingSample', () => {
  it('cộng dồn mẫu đủ dài', () => {
    const speed = addReadingSample(emptyReadingSpeed(), { words: 300, activeMs: 60000 });
    expect(speed).toEqual({ words: 300, activeMs: 60000 });
  });

  it('bỏ qua mẫu quá ngắn hoặc không hợp lệ', () => {
    expect(addReadingSample(emptyReadingSpeed(), { words: 300, activeMs: 2000 })).toEqual(
      emptyReadingSpeed(),
    );
    expect(addReadingSample(emptyReadingSpeed(), { words: 0, activeMs: 60000 })).toEqual(
      emptyReadingSpeed(),
    );
    expect(addReadingSample(emptyReadingSpeed(), { words: 10, activeMs: Number.NaN })).toEqual(
      emptyReadingSpeed(),
    );
  });
});

describe('wordsPerMinute', () => {
  it('dùng mặc định khi chưa đủ dữ liệu', () => {
    expect(wordsPerMinute(emptyReadingSpeed())).toBe(DEFAULT_WORDS_PER_MINUTE);
    expect(wordsPerMinute({ words: 50, activeMs: 60000 })).toBe(DEFAULT_WORDS_PER_MINUTE);
  });

  it('học tốc độ thực tế khi đủ dữ liệu', () => {
    expect(wordsPerMinute({ words: 600, activeMs: 120000 })).toBe(300);
    expect(wordsPerMinute({ words: 200, activeMs: 120000 })).toBe(100);
  });

  it('kẹp tốc độ học được trong khoảng hợp lý', () => {
    expect(wordsPerMinute({ words: 100, activeMs: 600000 })).toBe(50);
    expect(wordsPerMinute({ words: 50000, activeMs: 60000 })).toBe(1000);
  });
});

describe('estimateItemMinutes', () => {
  const item: TocTimeItem = { startPage: 1, endPage: 4, wordCount: 800 };

  it('tính theo số từ và tốc độ', () => {
    expect(estimateItemMinutes(item, 200)).toBe(4);
    expect(estimateItemMinutes(item, 0)).toBe(0);
  });
});

describe('roundedMinutes', () => {
  it('làm tròn phút để hiển thị', () => {
    expect(roundedMinutes(4.4)).toBe(4);
    expect(roundedMinutes(4.6)).toBe(5);
  });

  it('dưới một phút vẫn tính là 1, không có thì là 0', () => {
    expect(roundedMinutes(0.2)).toBe(1);
    expect(roundedMinutes(0)).toBe(0);
    expect(roundedMinutes(-3)).toBe(0);
    expect(roundedMinutes(Number.NaN)).toBe(0);
  });
});

describe('estimateRemainingTime', () => {
  const items: TocTimeItem[] = [
    { startPage: 1, endPage: 10, wordCount: 1000 },
    { startPage: 11, endPage: 20, wordCount: 500 },
  ];

  it('tính phần còn lại của mục đang đọc theo tỉ lệ trang', () => {
    const remaining = estimateRemainingTime(items, 5, 200);
    expect(remaining.sectionMinutes).toBeCloseTo(3);
    expect(remaining.totalMinutes).toBeCloseTo(5.5);
  });

  it('tính đúng khi đang ở mục cuối', () => {
    const remaining = estimateRemainingTime(items, 15, 200);
    expect(remaining.sectionMinutes).toBeCloseTo(1.5);
    expect(remaining.totalMinutes).toBeCloseTo(1.5);
  });

  it('tính toàn bộ khi còn trước mục đầu tiên', () => {
    const remaining = estimateRemainingTime(items, 0, 200);
    expect(remaining.totalMinutes).toBeCloseTo(7.5);
  });

  it('trả 0 khi đã qua mục cuối', () => {
    const remaining = estimateRemainingTime(items, 30, 200);
    expect(remaining.sectionMinutes).toBe(0);
    expect(remaining.totalMinutes).toBe(0);
  });

  it('trả 0 với danh sách rỗng hoặc tốc độ không hợp lệ', () => {
    expect(estimateRemainingTime([], 1, 200).totalMinutes).toBe(0);
    expect(estimateRemainingTime(items, 1, 0).totalMinutes).toBe(0);
  });
});

describe('chapterEstimate', () => {
  const toc = {
    source: 'outline' as const,
    items: [
      { title: 'A', startPage: 1, endPage: 3, level: 1, wordCount: 1000 },
      { title: 'B', startPage: 4, endPage: 6, level: 1, wordCount: 10 },
    ],
  };

  it('ước tính số phút của mục chứa trang đang đọc', () => {
    expect(chapterEstimate(toc, 2, 200)).toBe(5);
    expect(chapterEstimate(toc, 4, 200)).toBe(1);
  });

  it('mục ngắn vẫn tính ít nhất 1 phút', () => {
    expect(chapterEstimate(toc, 6, 1000)).toBe(1);
  });

  it('trả 0 khi chưa có mục lục, chưa có tốc độ đọc hoặc trang ngoài mọi mục', () => {
    expect(chapterEstimate(null, 1, 200)).toBe(0);
    expect(chapterEstimate(toc, 1, 0)).toBe(0);
    expect(chapterEstimate(toc, 99, 200)).toBe(0);
  });
});
