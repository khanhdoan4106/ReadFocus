import MiniSearch from 'minisearch';
import { normalizeText } from './text';

export type SearchPageInput = {
  page: number;
  text: string;
};

export type SearchHit = {
  page: number;
  text: string;
  snippet: string;
};

export type SearchOptions = {
  /** Bỏ dấu tiếng Việt ở cả chỉ mục lẫn từ khoá ("chuong" khớp "chương"). */
  ignoreDiacritics: boolean;
  limit?: number;
};

type IndexedParagraph = {
  id: number;
  page: number;
  text: string;
  normalized: string;
};

export type SearchIndex = MiniSearch<IndexedParagraph>;

const PARAGRAPH_MAX_CHARS = 400;
const SNIPPET_WORDS_BEFORE = 8;
const SNIPPET_WORDS_AFTER = 16;

/**
 * Chuẩn hoá tiếng Việt để tìm không dấu: NFD tách dấu, bỏ dấu kết hợp,
 * đổi `đ` thành `d`, rồi lowercase và gộp khoảng trắng.
 */
export function normalizeVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tách văn bản trang thành đoạn để đánh chỉ mục: ưu tiên dòng trống, sau đó
 * cắt các đoạn quá dài theo giới hạn ký tự để snippet còn dễ đọc.
 */
export function splitParagraphs(text: string, maxChars = PARAGRAPH_MAX_CHARS): string[] {
  const blocks = normalizeText(text).split(/\n{2,}/);
  const paragraphs: string[] = [];

  for (const block of blocks) {
    const words = block.split(/\s+/u).filter((word) => word !== '');
    let current = '';

    for (const word of words) {
      if (current !== '' && current.length + word.length + 1 > maxChars) {
        paragraphs.push(current);
        current = word;
      } else {
        current = current === '' ? word : `${current} ${word}`;
      }
    }

    if (current !== '') paragraphs.push(current);
  }

  return paragraphs;
}

export function buildSearchIndex(pages: readonly SearchPageInput[]): SearchIndex {
  const index = new MiniSearch<IndexedParagraph>({
    fields: ['text', 'normalized'],
    storeFields: ['page', 'text'],
    idField: 'id',
  });

  const paragraphs: IndexedParagraph[] = [];
  let id = 0;

  for (const page of pages) {
    for (const paragraph of splitParagraphs(page.text)) {
      paragraphs.push({
        id,
        page: page.page,
        text: paragraph,
        normalized: normalizeVietnamese(paragraph),
      });
      id += 1;
    }
  }

  index.addAll(paragraphs);
  return index;
}

/** Tìm trong chỉ mục đã dựng; từ khoá được chuẩn hoá khi bật tìm không dấu. */
export function searchIndex(
  index: SearchIndex,
  query: string,
  options: SearchOptions,
): SearchHit[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const term = options.ignoreDiacritics ? normalizeVietnamese(trimmed) : trimmed;
  if (term === '') return [];

  const results = index.search(term, {
    fields: options.ignoreDiacritics ? ['normalized'] : ['text'],
    prefix: true,
    // Không dùng fuzzy: từ tiếng Việt không dấu chỉ khác nhau một chữ cái
    // (chuong/phuong) nên fuzzy tạo quá nhiều kết quả nhiễu.
    fuzzy: false,
    combineWith: 'OR',
  });

  return results.slice(0, options.limit ?? 50).map((result) => {
    const text = typeof result.text === 'string' ? result.text : '';
    return {
      page: Number(result.page),
      text,
      snippet: makeSnippet(text, result.terms, options.ignoreDiacritics),
    };
  });
}

function comparable(text: string, ignoreDiacritics: boolean): string {
  return ignoreDiacritics ? normalizeVietnamese(text) : text.toLocaleLowerCase('vi');
}

/** Kiểm tra một đoạn chữ có chứa từ khoá hay không, tôn trọng tuỳ chọn bỏ dấu. */
export function matchesQuery(text: string, query: string, ignoreDiacritics: boolean): boolean {
  const needle = query.trim();
  if (needle === '') return false;
  return comparable(text, ignoreDiacritics).includes(comparable(needle, ignoreDiacritics));
}

/**
 * Cắt một cửa sổ từ quanh chỗ khớp đầu tiên. Giữ nguyên dấu trong snippet và
 * đánh dấu chỗ bị cắt bằng dấu ba chấm.
 */
export function makeSnippet(
  text: string,
  terms: readonly string[],
  ignoreDiacritics: boolean,
): string {
  const words = text.split(/\s+/u).filter((word) => word !== '');
  if (words.length === 0) return '';

  const needles = terms
    .map((term) => comparable(term, ignoreDiacritics))
    .filter((term) => term !== '');

  let matchIndex = 0;
  if (needles.length > 0) {
    const found = words.findIndex((word) => {
      const candidate = comparable(word, ignoreDiacritics);
      return needles.some((needle) => candidate.includes(needle));
    });
    if (found >= 0) matchIndex = found;
  }

  const start = Math.max(0, matchIndex - SNIPPET_WORDS_BEFORE);
  const end = Math.min(words.length, matchIndex + SNIPPET_WORDS_AFTER);
  const snippet = words.slice(start, end).join(' ');

  return `${start > 0 ? '… ' : ''}${snippet}${end < words.length ? ' …' : ''}`;
}
