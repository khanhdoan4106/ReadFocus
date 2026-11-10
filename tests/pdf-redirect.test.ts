import { describe, expect, it } from 'vitest';
import {
  buildViewerRedirect,
  isPdfRedirectUrl,
  readRequestedPdfUrl,
} from '../src/core/pdf-redirect';

describe('isPdfRedirectUrl', () => {
  it('khớp URL PDF http(s), kể cả query và fragment', () => {
    expect(isPdfRedirectUrl('https://example.com/a.pdf')).toBe(true);
    expect(isPdfRedirectUrl('https://example.com/thu-muc/a.PDF?x=1')).toBe(true);
    expect(isPdfRedirectUrl('http://example.com/a.pdf?x=1&y=2#page=3')).toBe(true);
    expect(isPdfRedirectUrl('https://example.com/download?file=sach.pdf')).toBe(true);
  });

  it('bỏ qua trang không phải PDF và giao thức khác', () => {
    expect(isPdfRedirectUrl('https://example.com/a.pdf.html')).toBe(false);
    expect(isPdfRedirectUrl('https://example.com/bai-viet')).toBe(false);
    expect(isPdfRedirectUrl('ftp://example.com/a.pdf')).toBe(false);
    expect(isPdfRedirectUrl('file:///C:/a.pdf')).toBe(false);
  });
});

describe('buildViewerRedirect', () => {
  it('gắn URL gốc vào tham số src', () => {
    expect(buildViewerRedirect('chrome-extension://abc/viewer.html')).toBe(
      'chrome-extension://abc/viewer.html?src=\\0',
    );
  });
});

describe('readRequestedPdfUrl', () => {
  it('đọc tham số url đã encode của context menu', () => {
    expect(readRequestedPdfUrl('?url=https%3A%2F%2Fexample.com%2Fa.pdf%3Fx%3D1%26y%3D2')).toBe(
      'https://example.com/a.pdf?x=1&y=2',
    );
  });

  it('đọc tham số src thô của rule chuyển hướng, giữ nguyên query', () => {
    expect(readRequestedPdfUrl('?src=https://example.com/a.pdf?x=1&y=2')).toBe(
      'https://example.com/a.pdf?x=1&y=2',
    );
    expect(readRequestedPdfUrl('?foo=1&src=http://example.com/a.pdf')).toBe(
      'http://example.com/a.pdf',
    );
  });

  it('giải mã ký tự đã encode trong src', () => {
    expect(readRequestedPdfUrl('?src=https://example.com/tai%20lieu.pdf')).toBe(
      'https://example.com/tai lieu.pdf',
    );
  });

  it('trả null khi không có tham số', () => {
    expect(readRequestedPdfUrl('')).toBeNull();
    expect(readRequestedPdfUrl('?foo=1')).toBeNull();
    expect(readRequestedPdfUrl('?url=')).toBeNull();
    expect(readRequestedPdfUrl('?src=')).toBeNull();
  });
});
