import type { PDFDocumentProxy } from 'pdfjs-dist';
import { outlineDepth, type PageSample } from '../core/profile';
import { joinTextItems } from '../core/text';

/** Số trang tối đa lập chỉ mục trong một lần, theo PLAN. */
export const INDEX_PAGE_LIMIT = 100;

export type ExtractedPage = PageSample & {
  page: number;
};

export type ExtractOptions = {
  from: number;
  to: number;
  onPage?: (page: ExtractedPage) => void;
  shouldStop?: () => boolean;
};

export async function extractPageText(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<ExtractedPage> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  return {
    page: pageNumber,
    width: viewport.width,
    height: viewport.height,
    text: joinTextItems(
      content.items.map((item) => ({
        str: 'str' in item ? item.str : undefined,
        hasEOL: 'hasEOL' in item && item.hasEOL,
      })),
    ),
  };
}

/**
 * Trích văn bản tăng dần: mỗi trang xong là báo ngay và nhường một nhịp cho UI,
 * nên không chặn việc đọc trong lúc lập chỉ mục.
 */
export async function extractRange(
  doc: PDFDocumentProxy,
  options: ExtractOptions,
): Promise<ExtractedPage[]> {
  const from = Math.max(1, Math.min(Math.round(options.from), doc.numPages));
  const to = Math.max(from, Math.min(Math.round(options.to), doc.numPages));
  const pages: ExtractedPage[] = [];

  for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
    if (options.shouldStop?.()) break;
    const extracted = await extractPageText(doc, pageNumber);
    pages.push(extracted);
    options.onPage?.(extracted);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  return pages;
}

/** Outline có thể lỗi hoặc không có; khi đó coi như độ sâu 0. */
export async function readOutlineDepth(doc: PDFDocumentProxy): Promise<number> {
  try {
    return outlineDepth(await doc.getOutline());
  } catch {
    return 0;
  }
}
