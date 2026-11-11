export type SummaryKeyPoint = {
  text: string;
  pages: number[];
};

export type SummaryTerm = {
  term: string;
  definition: string;
};

export type ParsedSummary = {
  summary: string;
  keyPoints: SummaryKeyPoint[];
  terms: SummaryTerm[];
};

export type PageRange = {
  startPage: number;
  endPage: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Bỏ ```json … ``` hoặc ``` … ``` mà model hay bọc quanh JSON. */
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

function keepPages(value: unknown, range: PageRange): number[] {
  if (!Array.isArray(value)) return [];

  const pages = new Set<number>();
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry)) continue;
    if (entry < range.startPage || entry > range.endPage) continue;
    pages.add(entry);
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * Đọc JSON do model trả về. JSON lỗi thì coi toàn bộ câu trả lời là `summary`
 * để người dùng vẫn thấy nội dung; số trang ngoài phạm vi mục bị bỏ.
 */
export function parseSummaryResponse(raw: string, range: PageRange): ParsedSummary {
  const text = raw.trim();
  if (text === '') return { summary: '', keyPoints: [], terms: [] };

  const parsed = parseObject(text);
  if (parsed === null) return { summary: stripFence(text), keyPoints: [], terms: [] };

  const summary = cleanText(parsed.summary);
  const keyPoints: SummaryKeyPoint[] = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints
        .map((entry): SummaryKeyPoint | null => {
          if (!isRecord(entry)) return null;
          const pointText = cleanText(entry.text);
          if (pointText === '') return null;
          return { text: pointText, pages: keepPages(entry.pages, range) };
        })
        .filter((entry): entry is SummaryKeyPoint => entry !== null)
    : [];

  const terms: SummaryTerm[] = Array.isArray(parsed.terms)
    ? parsed.terms
        .map((entry): SummaryTerm | null => {
          if (!isRecord(entry)) return null;
          const term = cleanText(entry.term);
          const definition = cleanText(entry.definition);
          if (term === '' || definition === '') return null;
          return { term, definition };
        })
        .filter((entry): entry is SummaryTerm => entry !== null)
    : [];

  if (summary === '' && keyPoints.length === 0) {
    return { summary: stripFence(text), keyPoints: [], terms };
  }

  return { summary, keyPoints, terms };
}
