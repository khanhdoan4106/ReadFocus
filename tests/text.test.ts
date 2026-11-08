import { describe, expect, it } from 'vitest';
import { countWords, joinTextItems, normalizeText } from '../src/core/text';

describe('joinTextItems', () => {
  it('nối các mẩu text và xuống dòng theo hasEOL', () => {
    expect(joinTextItems([{ str: 'Chương' }, { str: '1', hasEOL: true }, { str: 'Mở đầu' }])).toBe(
      'Chương 1\nMở đầu',
    );
  });

  it('bỏ qua mẩu rỗng hoặc không phải chuỗi', () => {
    expect(joinTextItems([{ str: '' }, {}, { str: 'xin chào' }])).toBe('xin chào');
  });

  it('gộp khoảng trắng thừa', () => {
    expect(joinTextItems([{ str: '  quá   nhiều ' }, { str: ' khoảng trắng ' }])).toBe(
      'quá nhiều khoảng trắng',
    );
  });
});

describe('normalizeText', () => {
  it('chuẩn hoá xuống dòng CRLF và khoảng trắng', () => {
    expect(normalizeText('một\r\nhai \t ba\n\n\n\nbốn')).toBe('một\nhai ba\n\nbốn');
  });

  it('cắt khoảng trắng ở hai đầu', () => {
    expect(normalizeText('  xin chào  ')).toBe('xin chào');
  });
});

describe('countWords', () => {
  it('đếm từ tiếng Việt', () => {
    expect(countWords('Đọc PDF nhanh và tập trung hơn')).toBe(7);
  });

  it('bỏ qua dấu câu đứng riêng', () => {
    expect(countWords('một , hai . — ba')).toBe(3);
  });

  it('trả 0 với chuỗi rỗng', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
});
