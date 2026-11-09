export type TextItemLike = {
  str?: unknown;
  hasEOL?: boolean;
};

/**
 * Ghép các mẩu text của pdf.js thành một chuỗi. Mỗi mẩu thường là một từ hoặc
 * một cụm từ nên cần chèn khoảng trắng; `hasEOL` đánh dấu hết dòng.
 */
export function joinTextItems(items: readonly TextItemLike[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (typeof item.str !== 'string' || item.str === '') continue;
    parts.push(item.str);
    if (item.hasEOL) parts.push('\n');
  }
  return normalizeText(parts.join(' '));
}

/** Chuẩn hoá Unicode NFC và gộp khoảng trắng thừa nhưng giữ xuống dòng để tách đoạn. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Đếm từ, bỏ qua các mẩu chỉ gồm dấu câu. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  let count = 0;
  for (const token of trimmed.split(/\s+/u)) {
    if (/[\p{L}\p{N}]/u.test(token)) count += 1;
  }
  return count;
}
