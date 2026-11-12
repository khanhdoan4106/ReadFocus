import type { ProviderId } from './types';

/** Endpoint gốc mặc định; cũng là origin cần xin quyền host ở T14. */
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
export const OPENAI_COMPATIBLE_BASE_URL = 'http://localhost:11434/v1';

/**
 * Model mặc định, kiểm tra ngày 11/11/2026:
 * - OpenAI: https://platform.openai.com/docs/models (GPT-6.1 Sol: cân bằng chất lượng/giá)
 * - Gemini: https://ai.google.dev/gemini-api/docs/models (Gemini 3.8 Flash)
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
 *   (Claude Sonnet 5.5: cân bằng tốc độ và chất lượng)
 * - OpenAI-compatible: thẻ phổ biến của Ollama; người dùng luôn sửa được.
 */
export const OPENAI_DEFAULT_MODEL = 'gpt-6.1-sol';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5-5';
export const OPENAI_COMPATIBLE_DEFAULT_MODEL = 'llama3.2';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  'openai-compatible': OPENAI_COMPATIBLE_DEFAULT_MODEL,
};

/**
 * Giới hạn đầu ra mặc định khi caller không truyền `maxTokens`. Model reasoning
 * mặc định dành phần lớn ngân sách cho thinking, nên 2.048 hay bị cắt; 8.192 đủ
 * cho một mục sách/paper mà vẫn tiết kiệm chi phí.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/** Model rỗng (người dùng xoá ô nhập) thì dùng model mặc định của provider. */
export function resolveModel(providerId: ProviderId, model: string): string {
  const trimmed = model.trim();
  return trimmed === '' ? DEFAULT_MODELS[providerId] : trimmed;
}
