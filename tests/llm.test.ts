import { describe, expect, it } from 'vitest';
import {
  badResponse,
  isLLMError,
  LLMError,
  normalizeFetchError,
  normalizeHttpError,
  parseRetryAfter,
  truncated,
} from '../src/core/llm/errors';
import type { LLMErrorKind } from '../src/core/llm/types';
import { vi } from '../src/i18n/vi';

describe('normalizeHttpError', () => {
  it('key sai hoặc bị chặn là invalid-key', () => {
    expect(normalizeHttpError(401, '').kind).toBe('invalid-key');
    expect(normalizeHttpError(403, '').kind).toBe('invalid-key');
    expect(normalizeHttpError(401, '').status).toBe(401);
  });

  it('Gemini trả 400 kèm API_KEY_INVALID vẫn là invalid-key', () => {
    expect(normalizeHttpError(400, '{"reason":"API_KEY_INVALID"}').kind).toBe('invalid-key');
    expect(normalizeHttpError(400, 'API key not valid. Please pass a valid API key.').kind).toBe(
      'invalid-key',
    );
    expect(normalizeHttpError(400, 'INVALID_ARGUMENT').kind).not.toBe('invalid-key');
  });

  it('404 hoặc body báo model không tồn tại là model-not-found', () => {
    expect(normalizeHttpError(404, '').kind).toBe('model-not-found');
    expect(
      normalizeHttpError(404, 'models/gemini-x is not found for API version v1beta').kind,
    ).toBe('model-not-found');
    expect(
      normalizeHttpError(404, 'The model `gpt-x` does not exist or you do not have access').kind,
    ).toBe('model-not-found');
    expect(normalizeHttpError(400, 'model_not_found').kind).toBe('model-not-found');
    expect(normalizeHttpError(400, 'unknown model: mistral').kind).toBe('model-not-found');
  });

  it('429 là rate-limit, trừ khi lỗi nói về hạn mức', () => {
    expect(normalizeHttpError(429, '').kind).toBe('rate-limit');
    expect(normalizeHttpError(429, 'rate limit reached').kind).toBe('rate-limit');
    expect(normalizeHttpError(429, 'insufficient_quota').kind).toBe('quota');
    expect(normalizeHttpError(429, 'You exceeded your current quota').kind).toBe('quota');
    expect(normalizeHttpError(429, 'billing hard limit').kind).toBe('quota');
  });

  it('413 hoặc thông báo quá dài là context-too-long', () => {
    expect(normalizeHttpError(413, '').kind).toBe('context-too-long');
    expect(normalizeHttpError(400, 'context length exceeded').kind).toBe('context-too-long');
    expect(normalizeHttpError(400, 'prompt is too long').kind).toBe('context-too-long');
    expect(normalizeHttpError(400, 'too many tokens').kind).toBe('context-too-long');
  });

  it('lỗi còn lại là unknown và có mã HTTP', () => {
    const badRequest = normalizeHttpError(400, 'temperature must be between 0 and 2');
    expect(badRequest.kind).toBe('unknown');
    expect(badRequest.status).toBe(400);
    expect(normalizeHttpError(500, '').kind).toBe('unknown');
    expect(normalizeHttpError(502, '').status).toBe(502);
    expect(normalizeHttpError(400, 'invalid model').kind).toBe('model-not-found');
  });

  it('không làm rò key trong thông báo lỗi', () => {
    const error = normalizeHttpError(401, 'Bearer sk-secret-key');
    expect(error.message).not.toContain('sk-secret-key');
  });
});

describe('parseRetryAfter', () => {
  it('đọc số giây', () => {
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter('1.5')).toBe(1500);
    expect(parseRetryAfter(' 3 ')).toBe(3000);
  });

  it('đọc ngày HTTP', () => {
    const value = new Date(Date.now() + 60_000).toUTCString();
    const ms = parseRetryAfter(value);
    expect(ms).not.toBeNull();
    expect(ms).toBeGreaterThan(50_000);
    expect(ms).toBeLessThanOrEqual(61_000);
  });

  it('ngày đã qua trả về 0', () => {
    expect(parseRetryAfter(new Date(Date.now() - 60_000).toUTCString())).toBe(0);
  });

  it('giá trị rỗng hoặc không hiểu thì trả về null', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('   ')).toBeNull();
    expect(parseRetryAfter('-1')).toBeNull();
    expect(parseRetryAfter('later')).toBeNull();
  });
});

describe('normalizeFetchError', () => {
  it('lỗi huỷ là cancelled', () => {
    const abort = new DOMException('aborted', 'AbortError');
    expect(normalizeFetchError(abort).kind).toBe('cancelled');
  });

  it('lỗi fetch khác là network', () => {
    expect(normalizeFetchError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(normalizeFetchError('boom').kind).toBe('network');
  });

  it('giữ nguyên LLMError đã chuẩn hoá', () => {
    const original = new LLMError('rate-limit', 'HTTP 429');
    expect(normalizeFetchError(original)).toBe(original);
  });
});

describe('LLMError', () => {
  it('giữ loại, mã HTTP và thời gian chờ', () => {
    const error = new LLMError('rate-limit', 'HTTP 429', {
      status: 429,
      retryAfterMs: 1500,
    });
    expect(error.kind).toBe('rate-limit');
    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(1500);
    expect(error.name).toBe('LLMError');
    expect(isLLMError(error)).toBe(true);
    expect(isLLMError(new Error('khác'))).toBe(false);
  });

  it('badResponse tạo lỗi bad-response', () => {
    const error = badResponse('JSON hỏng');
    expect(error.kind).toBe('bad-response');
    expect(error.message).toBe('JSON hỏng');
  });

  it('truncated tạo lỗi truncated', () => {
    const error = truncated('cắt');
    expect(error.kind).toBe('truncated');
    expect(error.message).toBe('cắt');
  });

  it('mọi loại lỗi đều có câu tiếng Việt', () => {
    const kinds: LLMErrorKind[] = [
      'invalid-key',
      'model-not-found',
      'rate-limit',
      'quota',
      'context-too-long',
      'network',
      'cancelled',
      'bad-response',
      'truncated',
      'unknown',
    ];
    for (const kind of kinds) {
      expect(vi.aiErrorMessages[kind].trim().length, kind).toBeGreaterThan(0);
    }
  });
});
