import { countWords } from './text';

export type DocKind = 'book' | 'paper' | 'slides' | 'unknown';

export type PageSample = {
  text: string;
  width: number;
  height: number;
};

export type OutlineNodeLike = {
  items?: readonly OutlineNodeLike[];
};

export type DocumentProfile = {
  kind: DocKind;
  /** Phần lớn trang không có lớp chữ (PDF scan ảnh). */
  isScanned: boolean;
  /** Số trang đã lấy mẫu. */
  pageCount: number;
  /** Tỉ lệ trang có lớp chữ, từ 0 đến 1. */
  textPageRatio: number;
  /** Số từ trung bình trên một trang có chữ. */
  averageWordsPerPage: number;
};

/** Trang có ít hơn số từ này coi như không có lớp chữ. */
const TEXT_PAGE_MIN_WORDS = 5;
const LANDSCAPE_RATIO = 0.6;
const SLIDES_MAX_WORDS = 120;

const ABSTRACT_PATTERN = /\b(abstract|tóm tắt)\b/iu;
const REFERENCES_PATTERN = /\b(references|tài liệu tham khảo|bibliography)\b/iu;
const CHAPTER_PATTERN = /\b(chương|chapter)\s+(?:\d+|[ivxlcdm]+)\b/iu;

/** Độ sâu lớn nhất của outline (bookmark) PDF. */
export function outlineDepth(items: readonly OutlineNodeLike[] | null | undefined): number {
  if (!items || items.length === 0) return 0;
  let max = 0;
  for (const item of items) {
    const depth = 1 + outlineDepth(item.items);
    if (depth > max) max = depth;
  }
  return max;
}

export function hasTextLayer(text: string): boolean {
  return countWords(text) >= TEXT_PAGE_MIN_WORDS;
}

/**
 * Phân loại tài liệu bằng heuristic theo PLAN:
 * slide (phần lớn trang ngang, ít chữ) → paper (có Abstract và References)
 * → sách (outline nhiều cấp hoặc có Chương/Chapter) → không rõ.
 */
export function buildProfile(
  samples: readonly PageSample[],
  options: { outlineDepth?: number } = {},
): DocumentProfile {
  const pageCount = samples.length;
  if (pageCount === 0) {
    return {
      kind: 'unknown',
      isScanned: false,
      pageCount: 0,
      textPageRatio: 0,
      averageWordsPerPage: 0,
    };
  }

  let landscape = 0;
  let textPages = 0;
  let words = 0;
  const texts: string[] = [];

  for (const sample of samples) {
    if (sample.width > sample.height) landscape += 1;

    const pageWords = countWords(sample.text);
    if (pageWords >= TEXT_PAGE_MIN_WORDS) {
      textPages += 1;
      words += pageWords;
    }
    texts.push(sample.text);
  }

  const textPageRatio = textPages / pageCount;
  const averageWordsPerPage = textPages === 0 ? 0 : words / textPages;
  const isScanned = textPageRatio < 0.5;
  const allText = texts.join('\n');

  let kind: DocKind = 'unknown';
  if (landscape / pageCount >= LANDSCAPE_RATIO && averageWordsPerPage <= SLIDES_MAX_WORDS) {
    kind = 'slides';
  } else if (ABSTRACT_PATTERN.test(allText) && REFERENCES_PATTERN.test(allText)) {
    kind = 'paper';
  } else if ((options.outlineDepth ?? 0) >= 2 || CHAPTER_PATTERN.test(allText)) {
    kind = 'book';
  }

  return { kind, isScanned, pageCount, textPageRatio, averageWordsPerPage };
}
