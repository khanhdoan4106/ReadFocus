export type TextItemLike = {
  str?: unknown;
  hasEOL?: boolean;
  transform?: readonly number[];
  width?: number;
  height?: number;
};

/** Khoảng cách ngang tối thiểu (theo cỡ chữ) để coi là thiếu một dấu cách. */
const SPACE_GAP_RATIO = 0.18;

function textOf(item: TextItemLike): string {
  return typeof item.str === 'string' ? item.str : '';
}

function isWhitespaceOnly(text: string): boolean {
  return text.trim() === '';
}

function horizontalPosition(item: TextItemLike): number | null {
  const transform = item.transform;
  if (!Array.isArray(transform) || transform.length < 6) return null;
  const x = transform[4];
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

function itemWidth(item: TextItemLike): number | null {
  return typeof item.width === 'number' && Number.isFinite(item.width) && item.width > 0
    ? item.width
    : null;
}

function fontSizeOf(item: TextItemLike): number {
  if (typeof item.height === 'number' && item.height > 0) return item.height;
  const transform = item.transform;
  if (!Array.isArray(transform)) return 0;
  const scale = Math.abs(transform[3] ?? transform[0] ?? 0);
  return Number.isFinite(scale) ? scale : 0;
}

/**
 * pdf.js thường tách một từ thành nhiều mẩu và phát mẩu khoảng trắng riêng, nên
 * không được chèn dấu cách giữa mọi mẩu. Chỉ chèn khi hai mẩu nằm sát nhau trên
 * cùng dòng, chưa có ký tự trắng, mà khoảng cách ngang đủ lớn để coi là một dấu cách.
 */
function needsSpaceBetween(previous: TextItemLike, next: TextItemLike): boolean {
  const previousText = textOf(previous);
  const nextText = textOf(next);
  if (previousText === '' || nextText === '' || isWhitespaceOnly(nextText)) return false;
  if (/\s$/u.test(previousText) || /^\s/u.test(nextText)) return false;

  const previousX = horizontalPosition(previous);
  const nextX = horizontalPosition(next);
  const width = itemWidth(previous);
  if (previousX === null || nextX === null || width === null) return false;

  const gap = nextX - (previousX + width);
  if (!Number.isFinite(gap) || gap <= 0) return false;

  const fontSize = Math.min(fontSizeOf(previous), fontSizeOf(next));
  const threshold = fontSize > 0 ? fontSize * SPACE_GAP_RATIO : 1;
  return gap > threshold;
}

/** Ghép các mẩu của một dòng, chèn khoảng trắng khi PDF không có glyph dấu cách. */
export function joinLineParts(items: readonly TextItemLike[]): string {
  const parts: string[] = [];
  let previous: TextItemLike | null = null;

  for (const item of items) {
    const text = textOf(item);
    if (text === '') continue;
    if (previous !== null && needsSpaceBetween(previous, item)) parts.push(' ');
    parts.push(text);
    previous = item;
  }

  return parts.join('');
}

/**
 * Ghép các mẩu text của pdf.js thành một chuỗi. Nối liền các mẩu như
 * `PDFFindController` của pdf.js (không tự chèn dấu cách giữa mọi mẩu), chỉ chèn
 * khoảng trắng khi thiếu glyph và có khoảng cách ngang đáng kể; `hasEOL` thành `\n`.
 */
export function joinTextItems(items: readonly TextItemLike[]): string {
  const parts: string[] = [];
  let previous: TextItemLike | null = null;
  let lineEnded = true;

  for (const item of items) {
    const text = textOf(item);
    if (text === '') {
      if (item.hasEOL && !lineEnded) {
        parts.push('\n');
        lineEnded = true;
        previous = null;
      }
      continue;
    }

    if (previous !== null && !lineEnded && needsSpaceBetween(previous, item)) parts.push(' ');

    parts.push(text);

    if (item.hasEOL) {
      parts.push('\n');
      lineEnded = true;
      previous = null;
    } else {
      lineEnded = false;
      previous = item;
    }
  }

  return normalizeText(parts.join(''));
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
