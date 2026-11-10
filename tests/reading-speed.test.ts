import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORDS_PER_MINUTE,
  speedFromWordsPerMinute,
  wordsPerMinute,
} from '../src/core/reading-time';

describe('speedFromWordsPerMinute', () => {
  it('quy đổi tốc độ thủ công thành mẫu một phút', () => {
    const speed = speedFromWordsPerMinute(250);
    expect(wordsPerMinute(speed)).toBe(250);
  });

  it('kẹp trong khoảng 50–1000 từ/phút', () => {
    expect(wordsPerMinute(speedFromWordsPerMinute(10))).toBe(50);
    expect(wordsPerMinute(speedFromWordsPerMinute(5000))).toBe(1000);
  });

  it('giá trị không hợp lệ dùng tốc độ mặc định', () => {
    expect(wordsPerMinute(speedFromWordsPerMinute(Number.NaN))).toBe(DEFAULT_WORDS_PER_MINUTE);
  });
});
