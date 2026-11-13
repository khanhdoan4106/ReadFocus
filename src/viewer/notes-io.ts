/** Tải một chuỗi về máy dưới dạng file (không gửi đi đâu). */
export function downloadText(fileName: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tên file an toàn cho hệ điều hành, bỏ đuôi `.pdf`. */
export function safeFileStem(name: string): string {
  const stem = name
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim();
  return stem === '' ? 'readfocus' : stem;
}
