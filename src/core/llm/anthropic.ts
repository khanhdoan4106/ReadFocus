import { requireApiKey } from './auth';
import { badResponse } from './errors';
import { isRecord, joinText, parseJson } from './json';
import { ANTHROPIC_BASE_URL, ANTHROPIC_DEFAULT_MODEL, DEFAULT_MAX_OUTPUT_TOKENS } from './models';
import { postJson } from './http';
import type { LLMCallOptions, LLMProvider, LLMRequest, ProviderConfig } from './types';

/** Gọi thẳng từ trình duyệt nên Anthropic yêu cầu header này. */
export const ANTHROPIC_BROWSER_HEADER = 'anthropic-dangerous-direct-browser-access';
export const ANTHROPIC_VERSION = '2023-06-01';

export function anthropicEndpoint(): string {
  return `${ANTHROPIC_BASE_URL}/messages`;
}

export function buildAnthropicBody(request: LLMRequest): Record<string, unknown> {
  return {
    model: request.model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    system: request.system,
    messages: [{ role: 'user', content: request.prompt }],
  };
}

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    [ANTHROPIC_BROWSER_HEADER]: 'true',
  };
}

export function parseAnthropicText(text: string): string {
  const root = parseJson(text);
  const content = isRecord(root) ? root.content : undefined;
  if (!Array.isArray(content)) throw badResponse('Missing response content');

  const pieces = content.map((block) =>
    isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : '',
  );
  const joined = joinText(pieces).trim();
  if (joined === '') throw badResponse('Empty response');
  return joined;
}

export const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  label: 'Anthropic Claude',
  defaultModel: ANTHROPIC_DEFAULT_MODEL,
  defaultBaseUrl: ANTHROPIC_BASE_URL,
  async complete(
    request: LLMRequest,
    config: ProviderConfig,
    callOptions?: LLMCallOptions,
  ): Promise<string> {
    const apiKey = requireApiKey(config);
    const response = await postJson(
      {
        url: anthropicEndpoint(),
        headers: anthropicHeaders(apiKey),
        body: buildAnthropicBody(request),
      },
      callOptions,
    );
    return parseAnthropicText(response.text);
  },
  async checkConnection(
    config: ProviderConfig,
    model: string,
    callOptions?: LLMCallOptions,
  ): Promise<void> {
    const apiKey = requireApiKey(config);
    await postJson(
      {
        url: anthropicEndpoint(),
        headers: anthropicHeaders(apiKey),
        body: buildAnthropicBody({
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
