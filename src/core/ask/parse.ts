import type { Citation, ParsedAnswer } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Bỏ ```json … ``` mà model hay bọc quanh JSON. */
function stripFence(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  return fenced?.[1]?.trim() ?? raw.trim();
}

function parseObject(raw: string): Record<string, unknown> | null {
  const text = stripFence(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function parseCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  const citations: Citation[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const page = entry.page;
    const quote = typeof entry.quote === 'string' ? entry.quote.trim() : '';
    if (typeof page !== 'number' || !Number.isInteger(page) || quote === '') continue;
    citations.push({ page, quote });
  }
  return citations;
}

/**
 * Phân tích câu trả lời của model, chịu lỗi: JSON hỏng thì dùng cả câu trả lời
 * làm văn bản, không có trích dẫn (sẽ bị đánh dấu chưa kiểm chứng).
 */
export function parseAnswer(raw: string): ParsedAnswer {
  const object = parseObject(raw);
  const answer = object !== null && typeof object.answer === 'string' ? object.answer.trim() : '';

  if (object === null || answer === '') {
    const text = raw.trim();
    return { answer: text, citations: [], found: text !== '', structured: false };
  }

  return {
    answer,
    citations: parseCitations(object.citations),
    // Thiếu trường `found` thì coi là có câu trả lời; chỉ `false` rõ ràng mới là không có.
    found: object.found !== false,
    structured: true,
  };
}
