import { sha256Hex } from '../hash';
import type { OutputLanguage } from './prompt';

export type SummaryCacheParts = {
  docId: string;
  startPage: number;
  endPage: number;
  title: string;
  providerId: string;
  model: string;
  promptVersion: number;
  language: OutputLanguage;
};

/** Chuỗi đầu vào chuẩn hoá; tách phần bằng NUL để không lẫn giữa các trường. */
export function summaryCacheInput(parts: SummaryCacheParts): string {
  return [
    parts.docId,
    String(parts.startPage),
    String(parts.endPage),
    parts.title.trim(),
    parts.providerId,
    parts.model.trim(),
    String(parts.promptVersion),
    parts.language,
  ].join('\u0000');
}

/** Khoá cache trong store `summaries`: băm toàn bộ yếu tố ảnh hưởng kết quả. */
export async function summaryCacheKey(parts: SummaryCacheParts): Promise<string> {
  const encoded = new TextEncoder().encode(summaryCacheInput(parts));
  const buffer = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer;
  return sha256Hex(buffer);
}
