import type { LLMProvider } from './types';
import { OPENAI_COMPATIBLE_BASE_URL, OPENAI_COMPATIBLE_DEFAULT_MODEL } from './models';
import { createOpenAiProvider } from './openai';

/**
 * Dùng cho Ollama, LM Studio hoặc gateway nội bộ. Dùng `max_tokens` thay vì
 * `max_completion_tokens` vì nhiều server tương thích chưa hỗ trợ trường mới.
 */
export const openAiCompatibleProvider: LLMProvider = createOpenAiProvider({
  id: 'openai-compatible',
  label: 'OpenAI-compatible',
  defaultModel: OPENAI_COMPATIBLE_DEFAULT_MODEL,
  defaultBaseUrl: OPENAI_COMPATIBLE_BASE_URL,
  maxTokensField: 'max_tokens',
  allowCustomBaseUrl: true,
});
