import { describe, expect, it } from 'vitest';
import { fileNameFromUrl, isFileUrl, isPdfUrl } from '../src/core/pdf-url';

describe('isPdfUrl', () => {
  it('nhận PDF http, https và file', () => {
    expect(isPdfUrl('https://example.com/sach.pdf')).toBe(true);
    expect(isPdfUrl('http://example.com/a.PDF?download=1#page=2')).toBe(true);
    expect(isPdfUrl('file:///C:/docs/tai-lieu.pdf')).toBe(true);
  });

  it('bỏ qua trang không phải PDF hoặc giao thức khác', () => {
    expect(isPdfUrl('https://example.com/bai-viet')).toBe(false);
    expect(isPdfUrl('https://example.com/a.pdf.html')).toBe(false);
    expect(isPdfUrl('ftp://example.com/a.pdf')).toBe(false);
    expect(isPdfUrl('không phải url')).toBe(false);
  });
});

describe('isFileUrl', () => {
  it('phân biệt file:// với web', () => {
    expect(isFileUrl('file:///C:/docs/a.pdf')).toBe(true);
    expect(isFileUrl('https://example.com/a.pdf')).toBe(false);
    expect(isFileUrl('nonsense')).toBe(false);
  });
});

describe('fileNameFromUrl', () => {
  it('lấy tên file đã giải mã', () => {
    expect(fileNameFromUrl('https://example.com/docs/tai%20lieu.pdf?x=1')).toBe('tai lieu.pdf');
    expect(fileNameFromUrl('file:///C:/docs/sach.pdf')).toBe('sach.pdf');
  });

  it('có tên dự phòng khi đường dẫn không có file', () => {
    expect(fileNameFromUrl('https://example.com/')).toBe('document.pdf');
    expect(fileNameFromUrl('nonsense')).toBe('document.pdf');
  });
});
