import type { LLMErrorKind } from './types';

/** Lỗi mạng/API đã chuẩn hoá; `status` và `retryAfterMs` chỉ để chẩn đoán. */
export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    kind: LLMErrorKind,
    message: string,
    options: { status?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'LLMError';
    this.kind = kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function isLLMError(value: unknown): value is LLMError {
  return value instanceof LLMError;
}

/** Lỗi đã có loại thì giữ nguyên, tránh bọc hai lần. */
function passthrough(value: unknown): LLMError | null {
  return isLLMError(value) ? value : null;
}

const CONTEXT_PATTERN =
  /context[ _-]?length|maximum context|too many tokens|token limit|input is too long|prompt is too long|exceeds the maximum/i;
const QUOTA_PATTERN =
  /quota|billing|credit balance|insufficient_quota|exceeded your current quota/i;
/** Gemini trả 400 (không phải 401) khi key sai; OpenAI/Anthropic thì dùng 401. */
const INVALID_KEY_PATTERN =
  /api_key_invalid|api key not valid|invalid api key|incorrect api key|api key is invalid|api key expired/i;
/** 404 hoặc body báo model không tồn tại; người dùng tự gõ tên model nên hay gặp. */
const MODEL_NOT_FOUND_PATTERN =
  /model_not_found|not_found_error|model[^.]{0,120}not found|model[^.]{0,120}does not exist|unknown model|no such model|invalid model|is not found for api version/i;

/** `Retry-After` có thể là số giây hoặc ngày HTTP; trả về mili giây. */
export function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? Math.round(seconds * 1000) : null;
  }
  if (!Number.isNaN(seconds)) return null;

  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(date - Date.now(), 0);
}

/** Chuyển mã HTTP và phần thân lỗi của nhà cung cấp thành loại lỗi chung. */
export function normalizeHttpError(status: number, body: string): LLMError {
  const text = body.slice(0, 2000);

  if (status === 401 || status === 403) {
    return new LLMError('invalid-key', `HTTP ${status}`, { status });
  }
  if (status === 400 && INVALID_KEY_PATTERN.test(text)) {
    return new LLMError('invalid-key', `HTTP ${status}`, { status });
  }
  if (status === 429) {
    const kind = QUOTA_PATTERN.test(text) ? 'quota' : 'rate-limit';
    return new LLMError(kind, `HTTP ${status}`, { status });
  }
  if (status === 404 || MODEL_NOT_FOUND_PATTERN.test(text)) {
    return new LLMError('model-not-found', `HTTP ${status}`, { status });
  }
  if (status === 413 || CONTEXT_PATTERN.test(text)) {
    return new LLMError('context-too-long', `HTTP ${status}`, { status });
  }
  if (status >= 500) {
    return new LLMError('unknown', `HTTP ${status}`, { status });
  }
  return new LLMError('unknown', `HTTP ${status}`, { status });
}

/** Lỗi từ `fetch` (mất mạng, CORS) hoặc từ AbortController. */
export function normalizeFetchError(error: unknown): LLMError {
  const known = passthrough(error);
  if (known !== null) return known;

  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : '';
  if (name === 'AbortError') {
    return new LLMError('cancelled', 'Aborted', { cause: error });
  }
  return new LLMError('network', 'Network request failed', { cause: error });
}

/** JSON không đọc được hoặc thiếu trường bắt buộc trong response thành công. */
export function badResponse(message: string, cause?: unknown): LLMError {
  return new LLMError('bad-response', message, { cause });
}

/** Model dừng vì chạm giới hạn đầu ra; chuỗi đã trả về là chưa hoàn chỉnh. */
export function truncated(message = 'Response was cut off by the output limit'): LLMError {
  return new LLMError('truncated', message);
}
