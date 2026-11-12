import type { TocItem } from '../../storage/db';
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

/** Giới hạn 100 trang như v0 cho tính năng tóm tắt toàn bộ. */
export const SUMMARY_MAX_PAGE = 100;

/**
 * Lọc các mục trong mục lục thuộc phạm vi tóm tắt toàn bộ (mặc định tối đa 100 trang).
 * Chỉ nhận các mục có `startPage` trong phạm vi và kẹp `endPage` không vượt quá `maxPage`.
 */
export function filterSummarizableSections(
  items: readonly TocItem[],
  maxPage = SUMMARY_MAX_PAGE,
): TocItem[] {
  const result: TocItem[] = [];
  for (const item of items) {
    if (item.startPage <= maxPage) {
      result.push({
        ...item,
        endPage: Math.min(item.endPage, maxPage),
      });
    }
  }
  return result;
}

/**
 * Kiểm tra xem một mục đã có tóm tắt trong danh sách cache chưa.
 */
export function hasSummaryForSection(
  summaries: readonly SummaryRecord[],
  section: { startPage: number; endPage: number },
): boolean {
  return summaries.some(
    (summary) => summary.startPage === section.startPage && summary.endPage === section.endPage,
  );
}

/**
 * Tìm bản tóm tắt mới nhất khớp với khoảng trang của một mục.
 */
export function findSummaryForSection(
  summaries: readonly SummaryRecord[],
  section: { startPage: number; endPage: number },
): SummaryRecord | undefined {
  return summaries.find(
    (summary) => summary.startPage === section.startPage && summary.endPage === section.endPage,
  );
}
