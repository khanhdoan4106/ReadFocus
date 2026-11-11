import { requireApiKey } from './auth';
import { badResponse, truncated } from './errors';
import { isRecord, joinText, parseJson } from './json';
import { DEFAULT_MAX_OUTPUT_TOKENS, OPENAI_BASE_URL, OPENAI_DEFAULT_MODEL } from './models';
import { normalizeBaseUrl, postJson } from './http';
import type { LLMCallOptions, LLMProvider, LLMRequest, ProviderConfig, ProviderId } from './types';

type MaxTokensField = 'max_completion_tokens' | 'max_tokens';

/** Mức thấp nhất hợp lệ cho tóm tắt; chỉ gửi cho OpenAI thật. */
export type ReasoningEffort = 'low';

export type OpenAiProviderOptions = {
  id: ProviderId;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  maxTokensField: MaxTokensField;
  /** Chỉ OpenAI-compatible mới cho phép đổi base URL. */
  allowCustomBaseUrl: boolean;
  /** OpenAI-compatible (Ollama, LM Studio) chạy nội bộ nên không cần key. */
  requiresApiKey: boolean;
  /** `reasoning_effort` chỉ dành cho OpenAI; server tương thích có thể từ chối. */
  reasoningEffort?: ReasoningEffort;
};

/** Dùng chung cho OpenAI và các endpoint tương thích (Ollama, LM Studio). */
export function buildOpenAiBody(
  request: LLMRequest,
  maxTokensField: MaxTokensField,
  reasoningEffort?: ReasoningEffort,
): Record<string, unknown> {
  return {
    model: request.model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    [maxTokensField]: request.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    ...(reasoningEffort === undefined ? {} : { reasoning_effort: reasoningEffort }),
  };
}

/** Không gửi header Authorization khi key rỗng (OpenAI-compatible nội bộ). */
function openAiHeaders(apiKey: string): Record<string, string> {
  return apiKey === '' ? {} : { authorization: `Bearer ${apiKey}` };
}

export function parseOpenAiText(text: string): string {
  const root = parseJson(text);
  const choices = isRecord(root) ? root.choices : undefined;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw badResponse('No choices in response');
  }

  const choice = choices[0];
  if (isRecord(choice) && choice.finish_reason === 'length') {
    throw truncated('OpenAI stopped at the output token limit');
  }

  const message = isRecord(choice) ? choice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed === '') throw badResponse('Empty response');
    return trimmed;
  }

  if (Array.isArray(content)) {
    const pieces = content.map((part) =>
      isRecord(part) && typeof part.text === 'string' ? part.text : '',
    );
    const joined = joinText(pieces).trim();
    if (joined === '') throw badResponse('Empty response');
    return joined;
  }

  if (isRecord(choice) && typeof choice.text === 'string' && choice.text.trim() !== '') {
    return choice.text.trim();
  }

  throw badResponse('Empty response');
}

export function createOpenAiProvider(options: OpenAiProviderOptions): LLMProvider {
  const endpoint = (baseUrl: string) => `${baseUrl}/chat/completions`;
  const resolveKey = (config: ProviderConfig) =>
    options.requiresApiKey ? requireApiKey(config) : config.apiKey.trim();

  return {
    id: options.id,
    label: options.label,
    defaultModel: options.defaultModel,
    defaultBaseUrl: options.defaultBaseUrl,
    async complete(
      request: LLMRequest,
      config: ProviderConfig,
      callOptions?: LLMCallOptions,
    ): Promise<string> {
      const apiKey = resolveKey(config);
      const baseUrl = options.allowCustomBaseUrl
        ? normalizeBaseUrl(config.baseUrl, options.defaultBaseUrl)
        : options.defaultBaseUrl;

      const response = await postJson(
        {
          url: endpoint(baseUrl),
          headers: openAiHeaders(apiKey),
          body: buildOpenAiBody(request, options.maxTokensField, options.reasoningEffort),
        },
        callOptions,
      );
      return parseOpenAiText(response.text);
    },
    async checkConnection(
      config: ProviderConfig,
      model: string,
      callOptions?: LLMCallOptions,
    ): Promise<void> {
      const apiKey = resolveKey(config);
      const baseUrl = options.allowCustomBaseUrl
        ? normalizeBaseUrl(config.baseUrl, options.defaultBaseUrl)
        : options.defaultBaseUrl;

      await postJson(
        {
          url: endpoint(baseUrl),
          headers: openAiHeaders(apiKey),
          body: buildOpenAiBody(
            {
              system: 'You are a connection test.',
              prompt: 'Reply with OK.',
              model,
              maxTokens: 8,
            },
            options.maxTokensField,
            options.reasoningEffort,
          ),
        },
        callOptions,
      );
    },
  };
}

export const openaiProvider: LLMProvider = createOpenAiProvider({
  id: 'openai',
  label: 'OpenAI',
  defaultModel: OPENAI_DEFAULT_MODEL,
  defaultBaseUrl: OPENAI_BASE_URL,
  maxTokensField: 'max_completion_tokens',
  allowCustomBaseUrl: false,
  requiresApiKey: true,
  reasoningEffort: 'low',
});
