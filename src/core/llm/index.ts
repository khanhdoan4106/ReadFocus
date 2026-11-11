import type { LLMProvider, ProviderId } from './types';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';
import { anthropicProvider } from './anthropic';
import { openAiCompatibleProvider } from './openai-compatible';

/** Thứ tự hiển thị trong Cài đặt → AI. */
export const providers: readonly LLMProvider[] = [
  openaiProvider,
  geminiProvider,
  anthropicProvider,
  openAiCompatibleProvider,
];

const byId: Record<ProviderId, LLMProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  'openai-compatible': openAiCompatibleProvider,
};

export function getProvider(id: ProviderId): LLMProvider {
  return byId[id];
}
