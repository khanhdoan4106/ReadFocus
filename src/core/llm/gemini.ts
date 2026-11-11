import { requireApiKey } from './auth';
import { badResponse, truncated } from './errors';
import { isRecord, joinText, parseJson } from './json';
import { DEFAULT_MAX_OUTPUT_TOKENS, GEMINI_BASE_URL, GEMINI_DEFAULT_MODEL } from './models';
import { postJson } from './http';
import type { LLMCallOptions, LLMProvider, LLMRequest, ProviderConfig } from './types';

export function geminiEndpoint(model: string): string {
  return `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
}

export function buildGeminiBody(request: LLMRequest): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      // Mặc định Gemini 3 tư duy mức medium; hạ xuống low để chừa ngân sách cho câu trả lời.
      thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}

export function parseGeminiText(text: string): string {
  const root = parseJson(text);
  const candidates = isRecord(root) ? root.candidates : undefined;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    const feedback = isRecord(root) ? root.promptFeedback : undefined;
    const reason =
      isRecord(feedback) && typeof feedback.blockReason === 'string' ? feedback.blockReason : null;
    throw badResponse(reason === null ? 'No candidates in response' : `Blocked: ${reason}`);
  }

  const candidate = candidates[0];
  if (isRecord(candidate) && candidate.finishReason === 'MAX_TOKENS') {
    throw truncated('Gemini stopped at the output token limit');
  }

  const content = isRecord(candidate) ? candidate.content : undefined;
  const parts = isRecord(content) ? content.parts : undefined;
  if (!Array.isArray(parts)) throw badResponse('Missing response parts');

  const pieces = parts.map((part) => {
    if (!isRecord(part) || part.thought === true) return '';
    return typeof part.text === 'string' ? part.text : '';
  });
  const joined = joinText(pieces).trim();
  if (joined === '') throw badResponse('Empty response');
  return joined;
}

export const geminiProvider: LLMProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModel: GEMINI_DEFAULT_MODEL,
  defaultBaseUrl: GEMINI_BASE_URL,
  async complete(
    request: LLMRequest,
    config: ProviderConfig,
    callOptions?: LLMCallOptions,
  ): Promise<string> {
    const apiKey = requireApiKey(config);
    const response = await postJson(
      {
        url: geminiEndpoint(request.model),
        headers: { 'x-goog-api-key': apiKey },
        body: buildGeminiBody(request),
      },
      callOptions,
    );
    return parseGeminiText(response.text);
  },
  async checkConnection(
    config: ProviderConfig,
    model: string,
    callOptions?: LLMCallOptions,
  ): Promise<void> {
    const apiKey = requireApiKey(config);
    await postJson(
      {
        url: geminiEndpoint(model),
        headers: { 'x-goog-api-key': apiKey },
        body: buildGeminiBody({
          system: 'You are a connection test.',
          prompt: 'Reply with OK.',
          model,
          maxTokens: 8,
        }),
      },
      callOptions,
    );
  },
};
