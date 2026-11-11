import { EN_CHARS_PER_TOKEN, estimateTokens, looksVietnamese, VI_CHARS_PER_TOKEN } from './tokens';

export const DEFAULT_INPUT_TOKEN_BUDGET = 12_000;

export type TextPage = {
  page: number;
  text: string;
};

export type TextChunk = {
  text: string;
  /** Các trang có trong đoạn, theo thứ tự và không trùng. */
  pages: number[];
  tokens: number;
};

type Unit = {
  text: string;
  page: number;
};

function paragraphUnits(page: TextPage): Unit[] {
  return page.text
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .map((text) => ({ text, page: page.page }));
}

/** Cắt một đoạn quá dài theo ranh giới từ, giữ nguyên thứ tự. */
function sliceLongText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const pieces: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    const cut = rest.lastIndexOf(' ', maxChars);
    const end = cut > maxChars / 2 ? cut : maxChars;
    pieces.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest !== '') pieces.push(rest);
  return pieces;
}

function expandUnit(unit: Unit, maxTokens: number): Unit[] {
  if (estimateTokens(unit.text) <= maxTokens) return [unit];

  const charsPerToken = looksVietnamese(unit.text) ? VI_CHARS_PER_TOKEN : EN_CHARS_PER_TOKEN;
  const maxChars = Math.max(maxTokens * charsPerToken, 200);

  return sliceLongText(unit.text, maxChars).map((text) => ({ text, page: unit.page }));
}

/**
 * Chia văn bản theo trang thành các đoạn không vượt ngân sách token. Mỗi đoạn giữ
 * số trang để kết quả tóm tắt trích dẫn được vị trí.
 */
export function splitIntoChunks(
  pages: readonly TextPage[],
  maxTokens = DEFAULT_INPUT_TOKEN_BUDGET,
): TextChunk[] {
  const budget = Number.isFinite(maxTokens) ? Math.max(Math.floor(maxTokens), 1) : 1;
  const units = pages
    .flatMap((page) => paragraphUnits(page))
    .flatMap((unit) => expandUnit(unit, budget));

  const chunks: TextChunk[] = [];
  let current: Unit[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const text = current.map((unit) => unit.text).join('\n\n');
    const pagesInChunk = [...new Set(current.map((unit) => unit.page))];
    chunks.push({ text, pages: pagesInChunk, tokens: estimateTokens(text) });
    current = [];
  };

  for (const unit of units) {
    const candidate = [...current, unit].map((item) => item.text).join('\n\n');
    if (current.length > 0 && estimateTokens(candidate) > budget) {
      flush();
    }
    current.push(unit);
  }
  flush();

  return chunks;
}
