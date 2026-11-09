import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageSample } from '../core/profile';
import { joinTextItems, normalizeText } from '../core/text';
import type { TocEntry, TocLine } from '../core/toc';

/** Số trang tối đa lập chỉ mục trong một lần, theo PLAN. */
export const INDEX_PAGE_LIMIT = 100;

export type ExtractedPage = PageSample & {
  page: number;
  lines: TocLine[];
};

export type ExtractOptions = {
  from: number;
  to: number;
  onPage?: (page: ExtractedPage) => void;
  shouldStop?: () => boolean;
};

type RawTextItem = {
  type?: unknown;
  str?: unknown;
  transform?: number[];
  height?: number;
  fontName?: string;
};

type RawStyles = Record<string, { fontFamily?: string } | undefined>;

type RawOutlineItem = {
  title: string;
  dest: string | unknown[] | null;
  items?: RawOutlineItem[];
};

type PageRef = Parameters<PDFDocumentProxy['getPageIndex']>[0];

type LineGroup = {
  y: number;
  x: number;
  parts: string[];
  fontSize: number;
  bold: boolean;
};

const BOLD_PATTERN = /bold|black|heavy|demi|semibold/i;

/**
 * Gom các mẩu text theo dòng (cùng toạ độ y) và lấy cỡ chữ lớn nhất trong dòng.
 * `normalizeText` chạy sau khi ghép để tiêu đề sạch khoảng trắng.
 */
function buildLines(items: readonly RawTextItem[], styles: RawStyles): TocLine[] {
  const groups: LineGroup[] = [];

  for (const item of items) {
    if (typeof item.str !== 'string' || item.str === '') continue;
    const transform = item.transform;
    if (!Array.isArray(transform) || transform.length < 6) continue;

    const y = transform[5] ?? 0;
    const x = transform[4] ?? 0;
    const fontSize =
      typeof item.height === 'number' && item.height > 0
        ? item.height
        : Math.abs(transform[3] ?? transform[0] ?? 0);

    let group = groups.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!group) {
      group = { y, x, parts: [], fontSize: 0, bold: false };
      groups.push(group);
    }

    group.parts.push(item.str);
    group.x = Math.min(group.x, x);
    group.fontSize = Math.max(group.fontSize, fontSize);
    if (!group.bold) {
      const family = styles[item.fontName ?? '']?.fontFamily ?? '';
      group.bold = BOLD_PATTERN.test(`${item.fontName ?? ''} ${family}`);
    }
  }

  return groups
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((group) => ({
      text: normalizeText(group.parts.join(' ')),
      fontSize: group.fontSize,
      bold: group.bold,
    }))
    .filter((line) => line.text !== '');
}

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
    lines: buildLines(content.items, content.styles),
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

async function resolveDestination(
  doc: PDFDocumentProxy,
  destination: string | unknown[] | null,
): Promise<number | null> {
  if (destination === null) return null;

  try {
    const resolved =
      typeof destination === 'string' ? await doc.getDestination(destination) : destination;
    if (!Array.isArray(resolved) || resolved.length === 0) return null;

    const ref = resolved[0];
    if (typeof ref === 'number') return ref + 1;
    if (typeof ref === 'object' && ref !== null) {
      return (await doc.getPageIndex(ref as PageRef)) + 1;
    }
    return null;
  } catch {
    return null;
  }
}

/** Outline/bookmark của PDF, đã đổi destination thành số trang (1-based). */
export async function readOutline(doc: PDFDocumentProxy): Promise<TocEntry[]> {
  let outline: RawOutlineItem[] | null;
  try {
    outline = await doc.getOutline();
  } catch {
    return [];
  }
  if (!outline) return [];

  const entries: TocEntry[] = [];

  const walk = async (items: readonly RawOutlineItem[], level: number): Promise<void> => {
    for (const item of items) {
      const startPage = await resolveDestination(doc, item.dest);
      const title = normalizeText(item.title);
      if (startPage !== null && title !== '') {
        entries.push({ title, startPage, level });
      }
      if (item.items && item.items.length > 0) {
        await walk(item.items, level + 1);
      }
    }
  };

  await walk(outline, 1);
  return entries;
}
