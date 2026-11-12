import type { TocItem } from '../../storage/db';
import type { TextPage } from './chunk';
import {
  PROMPT_VERSION,
  resolveOutputLanguage,
  type OutputLanguage,
  type SummaryLanguageSetting,
} from './prompt';
import type { SummaryRecord } from './record';
import { estimateSpansWork, pagesInSpan, type WorkEstimate } from './work';

/** Yếu tố của cấu hình hiện tại quyết định bản cache nào được dùng lại. */
export type SummaryConfig = {
  providerId: string;
  /** Model đã qua `resolveModel`, không bao giờ rỗng. */
  model: string;
  language: SummaryLanguageSetting;
};

type SectionRef = Pick<TocItem, 'title' | 'startPage' | 'endPage'>;

/** Ngôn ngữ đầu ra của một mục; "theo tài liệu" suy ra từ chính văn bản mục. */
export function sectionLanguage(
  setting: SummaryLanguageSetting,
  pages: readonly TextPage[],
): OutputLanguage {
  return resolveOutputLanguage(setting, pages.map((page) => page.text).join('\n\n'));
}

/**
 * Bản tóm tắt đã lưu dùng được cho mục này với cấu hình hiện tại. Khác provider,
 * model, phiên bản prompt, ngôn ngữ hay tiêu đề thì không phải bản cache của lần
 * chạy này.
 */
export function findCachedSummary(
  summaries: readonly SummaryRecord[],
  section: SectionRef,
  config: SummaryConfig,
  allPages: readonly TextPage[],
): SummaryRecord | undefined {
  const language = sectionLanguage(config.language, pagesInSpan(allPages, section));
  return summaries.find(
    (record) =>
      record.startPage === section.startPage &&
      record.endPage === section.endPage &&
      record.title.trim() === section.title.trim() &&
      record.providerId === config.providerId &&
      record.model === config.model &&
      record.promptVersion === PROMPT_VERSION &&
      record.language === language,
  );
}

/** Mọi trang của mục đều đã được trích chữ (nằm trong khoảng đã lập chỉ mục). */
export function isFullyExtracted(section: SectionRef, pages: readonly TextPage[]): boolean {
  const have = new Set(pages.map((page) => page.page));
  for (let page = section.startPage; page <= section.endPage; page += 1) {
    if (!have.has(page)) return false;
  }
  return true;
}

export type BatchPlan = {
  /** Mục cần gọi API: đã có chữ, đã trích đủ trang và chưa có cache. */
  todo: TocItem[];
  /** Số mục bỏ qua vì đã có bản tóm tắt hợp lệ. */
  cachedCount: number;
  estimate: WorkEstimate;
};

/**
 * Lập kế hoạch cho "Tóm tắt toàn bộ": chỉ các mục đã lập chỉ mục (tối đa 100
 * trang một lần) và chưa có cache; ước lượng tính đúng các mục đó, gồm cả
 * request gộp của mục dài.
 */
export function planSummarizeAll(
  items: readonly TocItem[],
  pages: readonly TextPage[],
  summaries: readonly SummaryRecord[],
  config: SummaryConfig,
): BatchPlan {
  const todo: TocItem[] = [];
  let cachedCount = 0;

  for (const item of items) {
    if (!isFullyExtracted(item, pages)) continue;
    const sectionPages = pagesInSpan(pages, item);
    if (!sectionPages.some((page) => page.text.trim().length > 0)) continue;
    if (findCachedSummary(summaries, item, config, pages)) {
      cachedCount += 1;
      continue;
    }
    todo.push(item);
  }

  const estimate = estimateSpansWork(
    todo.map((item) => ({ startPage: item.startPage, endPage: item.endPage })),
    pages,
  );
  return { todo, cachedCount, estimate };
}
