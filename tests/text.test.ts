import { describe, expect, it } from 'vitest';
import { countWords, joinLineParts, joinTextItems, normalizeText } from '../src/core/text';

function chunk(str: string, x: number, width: number, extra: { hasEOL?: boolean } = {}) {
  return { str, transform: [10, 0, 0, 10, x, 700], width, ...extra };
}

describe('joinTextItems', () => {
  it('nối các mẩu text và xuống dòng theo hasEOL', () => {
    expect(
      joinTextItems([
        chunk('Chương', 100, 40),
        chunk('1', 145, 5, { hasEOL: true }),
        chunk('Mở đầu', 100, 40),
      ]),
    ).toBe('Chương 1\nMở đầu');
  });

  it('bỏ qua mẩu rỗng hoặc không phải chuỗi', () => {
    expect(joinTextItems([{ str: '' }, {}, { str: 'xin chào' }])).toBe('xin chào');
  });

  it('gộp khoảng trắng thừa', () => {
    expect(joinTextItems([{ str: '  quá   nhiều ' }, { str: ' khoảng trắng ' }])).toBe(
      'quá nhiều khoảng trắng',
    );
  });

  it('ghép liền các mẩu bị tách giữa từ, không chèn dấu cách', () => {
    expect(joinTextItems([chunk('Ch', 100, 20), chunk('ương', 120, 36)])).toBe('Chương');
  });

  it('chèn dấu cách khi có khoảng cách ngang đáng kể mà thiếu glyph cách', () => {
    expect(joinTextItems([chunk('Chương', 100, 40), chunk('một', 150, 20)])).toBe('Chương một');
  });

  it('không chèn thêm khi PDF đã có mẩu khoảng trắng', () => {
    expect(
      joinTextItems([chunk('Chương', 100, 40), chunk(' ', 140, 5), chunk('một', 145, 20)]),
    ).toBe('Chương một');
  });

  it('không chèn dấu cách sau khi đã xuống dòng', () => {
    expect(joinTextItems([chunk('Chương', 100, 40, { hasEOL: true }), chunk('một', 100, 20)])).toBe(
      'Chương\nmột',
    );
  });
});

describe('joinLineParts', () => {
  it('ghép một dòng có cả mẩu tách giữa từ và mẩu cách nhau', () => {
    expect(
      joinLineParts([chunk('Ch', 100, 20), chunk('ương', 120, 36), chunk('một', 170, 20)]),
    ).toBe('Chương một');
  });
});

describe('normalizeText', () => {
  it('chuẩn hoá xuống dòng CRLF và khoảng trắng', () => {
    expect(normalizeText('một\r\nhai \t ba\n\n\n\nbốn')).toBe('một\nhai ba\n\nbốn');
  });

  it('cắt khoảng trắng ở hai đầu', () => {
    expect(normalizeText('  xin chào  ')).toBe('xin chào');
  });

  it('chuẩn hoá Unicode NFC cho văn bản dạng NFD', () => {
    const decomposed = 'Chương một'.normalize('NFD');
    const composed = 'Chương một'.normalize('NFC');

    expect(decomposed).not.toBe(composed);
    expect(normalizeText(decomposed)).toBe(composed);
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
