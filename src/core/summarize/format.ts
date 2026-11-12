import type { SummaryRecord } from './record';

/**
 * Định dạng kết quả tóm tắt thành văn bản thuần để sao chép vào clipboard.
 * Không dùng HTML hay markdown phức tạp.
 */
export function formatSummaryClipboard(record: SummaryRecord): string {
  const parts: string[] = [];

  if (record.title.trim()) {
    parts.push(record.title.trim(), '');
  }

  parts.push(record.summary.trim());

  if (record.keyPoints.length > 0) {
    parts.push('', 'Ý chính:');
    for (const point of record.keyPoints) {
      const pages = point.pages.length > 0 ? ` (Trang ${point.pages.join(', ')})` : '';
      parts.push(`- ${point.text}${pages}`);
    }
  }

  if (record.terms.length > 0) {
    parts.push('', 'Thuật ngữ:');
    for (const term of record.terms) {
      parts.push(`- ${term.term}: ${term.definition}`);
    }
  }

  return parts.join('\n').trim();
}
