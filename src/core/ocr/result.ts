import { averageConfidence } from './pages';
import type { OcrPageResult, OcrWord } from './types';

/** Hình dạng kết quả của tesseract.js mà ta dùng (tách khỏi thư viện để test được). */
export type RawOcrWord = {
  text?: unknown;
  confidence?: unknown;
  bbox?: { x0?: unknown; y0?: unknown; x1?: unknown; y1?: unknown };
};
export type RawOcrPage = {
  text?: unknown;
  blocks?: ReadonlyArray<{
    paragraphs?: ReadonlyArray<{ lines?: ReadonlyArray<{ words?: readonly RawOcrWord[] }> }>;
  }> | null;
};

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toWord(raw: RawOcrWord): OcrWord | null {
  if (typeof raw.text !== 'string' || raw.text.trim() === '') return null;
  const x0 = toNumber(raw.bbox?.x0);
  const y0 = toNumber(raw.bbox?.y0);
  const x1 = toNumber(raw.bbox?.x1);
  const y1 = toNumber(raw.bbox?.y1);
  if (x0 === null || y0 === null || x1 === null || y1 === null) return null;
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    text: raw.text.normalize('NFC'),
    confidence: toNumber(raw.confidence) ?? 0,
    box: { x0, y0, x1, y1 },
  };
}

/** Chuyển kết quả thô của engine thành `OcrPageResult`; từ hỏng hoặc rỗng bị bỏ. */
export function toOcrPageResult(raw: RawOcrPage, width: number, height: number): OcrPageResult {
  const words: OcrWord[] = [];
  for (const block of raw.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const rawWord of line.words ?? []) {
          const word = toWord(rawWord);
          if (word) words.push(word);
        }
      }
    }
  }

  const text = typeof raw.text === 'string' ? raw.text.normalize('NFC').trim() : '';
  return { text, confidence: averageConfidence(words), width, height, words };
}
