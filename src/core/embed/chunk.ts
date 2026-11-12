import type { Chunk } from './types';

export const CHUNK_TARGET_WORDS = 300;
export const CHUNK_OVERLAP_WORDS = 40;
/** Đoạn cuối ngắn hơn mức này thì gộp vào đoạn trước thay vì đứng riêng. */
export const CHUNK_MIN_WORDS = 60;

export type ChunkPageInput = { page: number; text: string };

function wordsOf(text: string): string[] {
  return text.split(/\s+/u).filter((word) => word !== '');
}

/**
 * Chia văn bản từng trang thành đoạn ~300 từ, gối đầu 40 từ. Mỗi đoạn nằm gọn
 * trong một trang nên trích dẫn "trang X" luôn đúng. Trang không có chữ bị bỏ.
 */
export function chunkPages(
  pages: readonly ChunkPageInput[],
  target = CHUNK_TARGET_WORDS,
  overlap = CHUNK_OVERLAP_WORDS,
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const { page, text } of pages) {
    const words = wordsOf(text);
    if (words.length === 0) continue;

    const step = Math.max(1, target - overlap);
    const starts: number[] = [];
    for (let start = 0; ; start += step) {
      starts.push(start);
      if (start + target >= words.length) break;
    }

    // Đoạn cuối chỉ có ít từ mới (ngoài phần gối đầu) thì kéo đoạn trước dài ra.
    const lastStart = starts[starts.length - 1] ?? 0;
    if (starts.length > 1 && words.length - lastStart - overlap < CHUNK_MIN_WORDS) {
      starts.pop();
    }

    const pieces = starts.map((start, i) =>
      i === starts.length - 1 ? words.slice(start) : words.slice(start, start + target),
    );

    pieces.forEach((piece, index) => {
      chunks.push({ id: `${page}:${index}`, page, index, text: piece.join(' ') });
    });
  }

  return chunks;
}

/**
 * Băm đồng bộ 53-bit (cyrb53) để phát hiện đoạn đã đổi nội dung; không dùng cho
 * bảo mật. Kèm độ dài để giảm va chạm.
 */
export function textHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${value.toString(36)}-${text.length}`;
}
