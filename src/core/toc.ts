import type { DocKind } from './profile';
import { countWords, normalizeText } from './text';

export type TocLine = {
  text: string;
  fontSize: number;
  bold?: boolean;
};

export type TocPage = {
  page: number;
  text: string;
  lines: readonly TocLine[];
  width: number;
  height: number;
};

/** Một mục trước khi tính trang kết thúc và số từ. */
export type TocEntry = {
  title: string;
  startPage: number;
  level: number;
};

export type TocItem = {
  title: string;
  startPage: number;
  endPage: number;
  level: number;
  wordCount: number;
};

export type TocSource = 'outline' | 'headings' | 'slides' | 'pages';

export type TocResult = {
  source: TocSource;
  items: TocItem[];
};

export type BuildTocOptions = {
  /** Outline đã phân giải sẵn thành số trang. */
  outline?: readonly TocEntry[] | null;
  pages: readonly TocPage[];
  pageCount?: number;
  kind?: DocKind;
};

const MAX_HEADING_WORDS = 12;
const MAX_HEADING_CHARS = 100;
const HEADING_SIZE_RATIO = 1.15;
const BOLD_SIZE_RATIO = 1.02;
const TOC_CHUNK_PAGES = 10;

const HEADING_PATTERN = /^(chương|chapter|phần|part|mục|bài)\b|^\d+(?:\.\d+)*\.?\s/iu;

function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(Math.round(page), 1), pageCount);
}

function headingLevel(title: string): number {
  const numbered = /^(\d+(?:\.\d+)*)\.?\s/u.exec(title);
  if (numbered?.[1]) return Math.min(numbered[1].split('.').length, 4);
  return 1;
}

/**
 * Lập mục lục theo đúng thứ tự ưu tiên trong PLAN:
 * outline PDF → heuristic tiêu đề → gom slide → chia mỗi 10 trang.
 */
export function buildToc(options: BuildTocOptions): TocResult {
  const pages = [...options.pages].sort((a, b) => a.page - b.page);
  const lastPage = pages.at(-1)?.page ?? 0;
  const pageCount = Math.max(options.pageCount ?? lastPage, lastPage);
  if (pageCount < 1) return { source: 'pages', items: [] };

  const outline = normalizeOutline(options.outline, pageCount);
  if (outline.length > 0) {
    return { source: 'outline', items: finalizeItems(outline, pages, pageCount) };
  }

  const headings = findHeadings(pages);
  if (headings.length > 0) {
    return { source: 'headings', items: finalizeItems(headings, pages, pageCount) };
  }

  if (options.kind === 'slides') {
    const slides = groupSlides(pages);
    if (slides.length > 0) {
      return { source: 'slides', items: finalizeItems(slides, pages, pageCount) };
    }
  }

  return { source: 'pages', items: finalizeItems(chunkPages(pageCount), pages, pageCount) };
}

function normalizeOutline(
  outline: readonly TocEntry[] | null | undefined,
  pageCount: number,
): TocEntry[] {
  if (!outline) return [];
  return outline
    .map((entry) => ({
      title: normalizeText(entry.title),
      startPage: clampPage(entry.startPage, pageCount),
      level: Math.min(Math.max(Math.round(entry.level), 1), 6),
    }))
    .filter((entry) => entry.title !== '');
}

/** Điền trang kết thúc và số từ cho từng mục, dựa trên mục kế tiếp. */
function finalizeItems(
  entries: readonly TocEntry[],
  pages: readonly TocPage[],
  pageCount: number,
): TocItem[] {
  const sorted = [...entries].sort((a, b) => a.startPage - b.startPage);
  const wordsByPage = new Map<number, number>();
  for (const page of pages) {
    wordsByPage.set(page.page, countWords(page.text));
  }

  return sorted.map((entry, index) => {
    const next = sorted[index + 1];
    const endPage = Math.max(
      entry.startPage,
      next ? Math.min(next.startPage - 1, pageCount) : pageCount,
    );

    let wordCount = 0;
    for (let page = entry.startPage; page <= endPage; page += 1) {
      wordCount += wordsByPage.get(page) ?? 0;
    }

    return {
      title: entry.title,
      startPage: entry.startPage,
      endPage,
      level: entry.level,
      wordCount,
    };
  });
}

/**
 * Cỡ chữ thân bài là cỡ chữ chiếm nhiều ký tự nhất, để không bị vài dòng
 * tiêu đề lớn làm lệch ngưỡng.
 */
function bodyFontSize(pages: readonly TocPage[]): number {
  const weightBySize = new Map<number, number>();
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.text.trim() === '') continue;
      const size = Math.round(line.fontSize * 2) / 2;
      weightBySize.set(size, (weightBySize.get(size) ?? 0) + line.text.length);
    }
  }

  let body = 0;
  let best = 0;
  for (const [size, weight] of weightBySize) {
    if (weight > best) {
      best = weight;
      body = size;
    }
  }
  return body;
}

function findHeadings(pages: readonly TocPage[]): TocEntry[] {
  const body = bodyFontSize(pages);
  if (body <= 0) return [];

  const entries: TocEntry[] = [];
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.lines) {
      const title = normalizeText(line.text);
      if (title === '' || seen.has(title)) continue;
      if (countWords(title) > MAX_HEADING_WORDS || title.length > MAX_HEADING_CHARS) continue;
      if (!HEADING_PATTERN.test(title)) continue;

      const bigger = line.fontSize >= body * HEADING_SIZE_RATIO;
      const boldEnough = line.bold === true && line.fontSize >= body * BOLD_SIZE_RATIO;
      if (!bigger && !boldEnough) continue;

      seen.add(title);
      entries.push({ title, startPage: page.page, level: headingLevel(title) });
    }
  }

  return entries;
}

/** Bỏ hậu tố đánh số/tiếp theo để gom các slide cùng chủ đề. */
function slideGroupKey(title: string): string {
  return title
    .toLocaleLowerCase('vi')
    .replace(/\s*(?:\(|-|–|\[)\s*(?:tiếp|continued|\d+)\s*[)\]]?\s*$/giu, '')
    .trim();
}

function groupSlides(pages: readonly TocPage[]): TocEntry[] {
  const entries: TocEntry[] = [];
  let lastKey = '';

  for (const page of pages) {
    const title = normalizeText(page.lines[0]?.text ?? '');
    if (title === '') continue;

    const key = slideGroupKey(title);
    if (key === lastKey) continue;

    lastKey = key;
    entries.push({ title, startPage: page.page, level: 1 });
  }

  return entries;
}

function chunkPages(pageCount: number): TocEntry[] {
  const entries: TocEntry[] = [];
  for (let start = 1; start <= pageCount; start += TOC_CHUNK_PAGES) {
    entries.push({ title: '', startPage: start, level: 1 });
  }
  return entries;
}
