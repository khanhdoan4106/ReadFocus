/** ID cố định của rule tự chuyển PDF, đủ lớn để không đụng rule khác. */
export const PDF_REDIRECT_RULE_ID = 9001;

/**
 * Chỉ bắt URL http(s) có phần đường dẫn kết thúc bằng .pdf (không phân biệt hoa
 * thường), cho phép query và fragment phía sau. Phần trước đuôi file không được
 * chứa `?`/`#`, nhờ vậy link như `search?q=report.pdf` không bị chuyển hướng.
 * Không bắt tài nguyên nhúng vì rule chỉ áp cho `main_frame`.
 */
export const PDF_REDIRECT_REGEX = '^https?://[^?#]*\\.[Pp][Dd][Ff](\\?[^#]*)?(#.*)?$';

export function isPdfRedirectUrl(url: string): boolean {
  return new RegExp(PDF_REDIRECT_REGEX).test(url);
}

/** Đích chuyển hướng: viewer nhận URL gốc qua tham số `src`. */
export function buildViewerRedirect(viewerUrl: string): string {
  return `${viewerUrl}?src=\\0`;
}

/**
 * Đọc URL PDF mà viewer cần mở. `url` do context menu gửi (đã encode), còn
 * `src` do rule chuyển hướng gửi (URL gốc, có thể còn `&` trong query) nên phải
 * lấy phần còn lại của chuỗi thay vì tách theo `&`.
 */
export function readRequestedPdfUrl(search: string): string | null {
  const encoded = new URLSearchParams(search).get('url');
  if (encoded !== null && encoded !== '') return encoded;

  const match = /(?:^|[?&])src=([\s\S]*)$/.exec(search);
  const raw = match?.[1];
  if (raw === undefined || raw === '') return null;

  try {
    return decodeURI(raw);
  } catch {
    return raw;
  }
}
