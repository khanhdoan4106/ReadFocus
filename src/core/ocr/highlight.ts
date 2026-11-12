import { matchesQuery } from '../search';
import { boxToPageRect } from './geometry';
import type { OcrWord } from './types';

export type HighlightRect = {
  /** Phần trăm so với chiều rộng/cao của trang: đúng với mọi mức zoom. */
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Các từ OCR khớp với từ khoá. Từ khoá nhiều từ chỉ khớp khi các từ liên tiếp
 * trong thứ tự đọc khớp lần lượt từng từ của nó.
 */
export function findOcrHighlightWords(
  words: readonly OcrWord[],
  query: string,
  ignoreDiacritics: boolean,
): OcrWord[] {
  const tokens = query.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) return [];

  const matched = new Set<number>();
  for (let start = 0; start + tokens.length <= words.length; start += 1) {
    const hit = tokens.every((token, offset) => {
      const word = words[start + offset];
      return word !== undefined && matchesQuery(word.text, token, ignoreDiacritics);
    });
    if (hit) {
      for (let offset = 0; offset < tokens.length; offset += 1) matched.add(start + offset);
    }
  }
  return [...matched].sort((a, b) => a - b).flatMap((index) => words[index] ?? []);
}

/** Hình chữ nhật tô sáng theo phần trăm của trang cho các từ khớp. */
export function ocrHighlightRects(
  words: readonly OcrWord[],
  query: string,
  ignoreDiacritics: boolean,
  image: { width: number; height: number },
): HighlightRect[] {
  const percent = { width: 100, height: 100 };
  return findOcrHighlightWords(words, query, ignoreDiacritics).flatMap(
    (word) => boxToPageRect(word.box, image, percent) ?? [],
  );
}
