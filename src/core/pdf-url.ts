/** Địa chỉ có phải PDF mở được từ web hoặc từ đĩa hay không. */
export function isPdfUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') {
      return false;
    }
    return url.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

export function isFileUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'file:';
  } catch {
    return false;
  }
}

/** Lấy tên file từ đường dẫn để hiện trên thanh công cụ và lưu metadata. */
export function fileNameFromUrl(raw: string): string {
  try {
    const last = new URL(raw).pathname.split('/').filter(Boolean).pop();
    if (last === undefined || last === '') return 'document.pdf';
    return decodeURIComponent(last);
  } catch {
    return 'document.pdf';
  }
}
