import type { DocKind } from '../profile';
import type { LLMProvider, ProviderConfig } from '../llm/types';
import { DEFAULT_INPUT_TOKEN_BUDGET, splitIntoChunks, type TextPage } from './chunk';
import { parseSummaryResponse, type ParsedSummary } from './parse';
import {
  buildMergePrompt,
  buildSummaryPrompt,
  type PartialSummary,
  type SummaryLanguageSetting,
} from './prompt';

export type SummarizeSectionInput = {
  provider: LLMProvider;
  config: ProviderConfig;
  model: string;
  kind: DocKind;
  title: string;
  pages: readonly TextPage[];
  language: SummaryLanguageSetting;
  maxInputTokens?: number;
  signal?: AbortSignal;
  /** Gọi sau mỗi request để UI hiện tiến độ. */
  onProgress?: (done: number, total: number) => void;
};

export type SectionSummary = ParsedSummary & {
  /** Số request đã dùng; 0 khi mục không có chữ. */
  requests: number;
  inputTokens: number;
  /** Mục dài bị chia đoạn rồi gộp lại. */
  reduced: boolean;
};

/** Nội dung một phần để đưa vào prompt gộp: tóm tắt + các ý chính. */
function partialText(parsed: ParsedSummary): string {
  if (parsed.keyPoints.length === 0) return parsed.summary;
  const points = parsed.keyPoints.map((point) => `- ${point.text}`).join('\n');
  return `${parsed.summary}\n${points}`.trim();
}

/**
 * Tóm tắt một mục. Mục vừa ngân sách thì gọi một lần; mục dài được chia theo
 * đoạn (giữ số trang), tóm tắt từng phần rồi gộp — map-reduce hai tầng.
 */
export async function summarizeSection(input: SummarizeSectionInput): Promise<SectionSummary> {
  const chunks = splitIntoChunks(input.pages, input.maxInputTokens ?? DEFAULT_INPUT_TOKEN_BUDGET);
  const range = {
    startPage: Math.min(...input.pages.map((page) => page.page)),
    endPage: Math.max(...input.pages.map((page) => page.page)),
  };

  if (chunks.length === 0) {
    return { summary: '', keyPoints: [], terms: [], requests: 0, inputTokens: 0, reduced: false };
  }

  const total = chunks.length + (chunks.length > 1 ? 1 : 0);
  let done = 0;
  const complete = async (system: string, prompt: string): Promise<string> => {
    input.signal?.throwIfAborted();
    const text = await input.provider.complete(
      { system, prompt, model: input.model },
      input.config,
      { signal: input.signal },
    );
    done += 1;
    input.onProgress?.(done, total);
    return text;
  };

  const single = chunks[0];
  if (chunks.length === 1 && single) {
    const built = buildSummaryPrompt({
      kind: input.kind,
      title: input.title,
      text: single.text,
      language: input.language,
    });
    const parsed = parseSummaryResponse(await complete(built.system, built.prompt), range);
    return {
      ...parsed,
      requests: 1,
      inputTokens: single.tokens,
      reduced: false,
    };
  }

  const partials: PartialSummary[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const built = buildSummaryPrompt({
      kind: input.kind,
      title: input.title,
      text: chunk.text,
      language: input.language,
      partLabel: `part ${index + 1}/${chunks.length}`,
    });
    const parsed = parseSummaryResponse(await complete(built.system, built.prompt), range);
    partials.push({ summary: partialText(parsed), pages: chunk.pages });
  }

  const merged = buildMergePrompt({
    kind: input.kind,
    title: input.title,
    language: input.language,
    partials,
    sampleText: chunks.map((chunk) => chunk.text).join('\n\n'),
  });
  const parsed = parseSummaryResponse(await complete(merged.system, merged.prompt), range);

  return {
    ...parsed,
    requests: total,
    inputTokens: chunks.reduce((sum, chunk) => sum + chunk.tokens, 0),
    reduced: true,
  };
}
