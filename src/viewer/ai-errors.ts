import { isLLMError } from '../core/llm/errors';
import { isLocalBaseUrl, providerDefaultBaseUrl } from '../core/llm/permissions';
import type { AiSettings } from '../core/llm/settings';
import { t } from '../i18n';

/** Câu lỗi AI; thêm gợi ý CORS khi dùng server local (Ollama, LM Studio). */
export function aiErrorMessage(error: unknown, settings: AiSettings): string {
  if (!isLLMError(error)) return t.aiErrorMessages.unknown;
  const base = t.aiErrorMessages[error.kind];
  if (error.kind !== 'network' && error.kind !== 'unknown') return base;

  const baseUrl =
    settings.baseUrl.trim() === '' ? providerDefaultBaseUrl(settings.providerId) : settings.baseUrl;
  if (settings.providerId === 'openai-compatible' && isLocalBaseUrl(baseUrl)) {
    return `${base} ${t.aiCorsHint}`;
  }
  return base;
}
