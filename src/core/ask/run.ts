import { LLMError } from '../llm/errors';
import type { LLMProvider, ProviderConfig, ProviderId } from '../llm/types';
import type { Chunk } from '../embed/types';
import { buildContext } from './context';
import { parseAnswer } from './parse';
import { ASK_PROMPT_VERSION, buildAskPrompt } from './prompt';
import type { QaRecord } from './types';
import { verifyCitations } from './verify';

/** Giới hạn đầu ra cho một câu trả lời kèm trích dẫn; chừa chỗ cho model suy luận. */
export const ASK_MAX_OUTPUT_TOKENS = 4096;
export const MAX_QUESTION_LENGTH = 1000;

export type AskInput = {
  docId: string;
  question: string;
  /** Đoạn đã xếp hạng, liên quan nhất trước. */
  ranked: readonly Chunk[];
  provider: LLMProvider;
  providerId: ProviderId;
  config: ProviderConfig;
  model: string;
  pageText: (page: number) => string | undefined;
  signal: AbortSignal;
  now?: () => number;
  newId?: () => string;
};

/**
 * Một câu hỏi = một request. Không có đoạn liên quan thì không gọi mạng. Trích
 * dẫn được kiểm chứng với ngữ cảnh đã gửi trước khi trả về.
 */
export async function askQuestion(input: AskInput): Promise<QaRecord | null> {
  const question = input.question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (question === '' || input.ranked.length === 0) return null;
  if (input.signal.aborted) throw new LLMError('cancelled', 'Aborted');

  const context = buildContext(input.ranked);
  const prompt = buildAskPrompt(question, context.text);
  const raw = await input.provider.complete(
    {
      system: prompt.system,
      prompt: prompt.prompt,
      model: input.model,
      maxTokens: ASK_MAX_OUTPUT_TOKENS,
    },
    input.config,
    { signal: input.signal },
  );
  if (input.signal.aborted) throw new LLMError('cancelled', 'Aborted');

  const verified = verifyCitations({
    parsed: parseAnswer(raw),
    sentPages: new Set(context.chunks.map((chunk) => chunk.page)),
    pageText: input.pageText,
  });

  const now = (input.now ?? Date.now)();
  return {
    id: (input.newId ?? (() => crypto.randomUUID()))(),
    docId: input.docId,
    question,
    answer: verified.answer,
    found: verified.found,
    citations: verified.citations,
    unverified: verified.unverified,
    providerId: input.providerId,
    model: input.model,
    promptVersion: ASK_PROMPT_VERSION,
    createdAt: now,
  };
}
