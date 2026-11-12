import {
  ANTHROPIC_BASE_URL,
  GEMINI_BASE_URL,
  OPENAI_BASE_URL,
  OPENAI_COMPATIBLE_BASE_URL,
} from './models';
import type { ProviderId } from './types';

/**
 * Đúng danh sách trong v1 của `docs/PLAN.md`. Xin lúc người dùng chọn provider,
 * không xin lúc cài; base URL khác danh sách này phải xin tại thời điểm dùng.
 */
export const LLM_HOST_ORIGINS = [
  'https://api.openai.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://api.anthropic.com/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
] as const;

const PROVIDER_ORIGIN: Record<ProviderId, string> = {
  openai: 'https://api.openai.com/*',
  gemini: 'https://generativelanguage.googleapis.com/*',
  anthropic: 'https://api.anthropic.com/*',
  'openai-compatible': 'http://localhost/*',
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Đổi một URL bất kỳ thành match pattern của Chrome. Match pattern không nhận
 * cổng, nên chỉ lấy scheme + hostname; chỉ chấp nhận http/https.
 */
export function originPatternForUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

/** Origin cần xin cho provider; `openai-compatible` theo base URL người dùng nhập. */
export function providerOriginPattern(providerId: ProviderId, baseUrl?: string): string {
  if (providerId !== 'openai-compatible') return PROVIDER_ORIGIN[providerId];

  const custom = originPatternForUrl(baseUrl ?? '');
  return custom ?? originPatternForUrl(OPENAI_COMPATIBLE_BASE_URL) ?? 'http://localhost/*';
}

/** Base URL mặc định của từng provider, dùng khi ô nhập để trống. */
export function providerDefaultBaseUrl(providerId: ProviderId): string {
  switch (providerId) {
    case 'openai':
      return OPENAI_BASE_URL;
    case 'gemini':
      return GEMINI_BASE_URL;
    case 'anthropic':
      return ANTHROPIC_BASE_URL;
    case 'openai-compatible':
      return OPENAI_COMPATIBLE_BASE_URL;
  }
}

/** hostname local có trong danh sách quyền mặc định hay không (để gợi ý CORS). */
export function isLocalBaseUrl(rawUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(rawUrl.trim()).hostname);
  } catch {
    return false;
  }
}
