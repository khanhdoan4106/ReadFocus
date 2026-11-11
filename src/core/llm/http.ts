import { LLMError, normalizeFetchError, normalizeHttpError, parseRetryAfter } from './errors';

/** Số lần thử lại tối đa khi gặp 429, theo đặc tả v1. */
export const MAX_RATE_LIMIT_RETRIES = 2;

/** Backoff cơ sở khi nhà cung cấp không gửi `Retry-After`. */
const RETRY_BASE_DELAY_MS = 500;

export type JsonRequest = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

export type JsonResponse = {
  status: number;
  text: string;
};

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/** Chờ có thể huỷ; huỷ giữa lúc chờ cũng thành lỗi `cancelled`. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    // Có thể bị huỷ ngay giữa lúc đăng ký listener; listener không chạy lại.
    if (signal?.aborted) onAbort();
  });
}

/**
 * Gửi POST JSON và chỉ trả về khi HTTP 2xx. Tự thử lại 429 tối đa 2 lần, dùng
 * `Retry-After` nếu có, nếu không thì backoff 0,5 s rồi 1 s. Mọi lỗi được
 * chuẩn hoá thành `LLMError`; không đưa body hay key vào thông báo.
 */
export async function postJson(
  request: JsonRequest,
  options: { signal?: AbortSignal } = {},
): Promise<JsonResponse> {
  const { signal } = options;

  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw new LLMError('cancelled', 'Aborted');

    let response: Response;
    try {
      response = await fetch(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...request.headers },
        body: JSON.stringify(request.body),
        signal,
      });
    } catch (error) {
      throw normalizeFetchError(error);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw normalizeFetchError(error);
    }

    if (response.ok) return { status: response.status, text };

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
      const waitMs = retryAfterMs ?? RETRY_BASE_DELAY_MS * 2 ** attempt;
      try {
        await delay(waitMs, signal);
      } catch (error) {
        throw normalizeFetchError(error);
      }
      continue;
    }

    throw normalizeHttpError(response.status, text);
  }
}

/**
 * Chuẩn hoá base URL người dùng nhập: bỏ dấu `/` cuối, thêm `/v1` khi không có
 * đường dẫn (Ollama nhận `http://localhost:11434`), chỉ cho http/https.
 */
export function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? '').trim() || fallback;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LLMError('unknown', 'Base URL is not valid');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new LLMError('unknown', 'Base URL must use http or https');
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${path === '' ? '/v1' : path}`;
}
