import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLLMError } from '../src/core/llm/errors';
import { providers } from '../src/core/llm/index';
import { vi as viText } from '../src/i18n/vi';

const KEY = 'sk-super-secret-key-123';
const RESPONSE_BODY = `provider echo: bad key ${KEY} and prompt text`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lỗi từ provider không chứa key hay nội dung response thô', () => {
  const statuses = [400, 401, 403, 404, 413, 429, 500];

  for (const provider of Object.values(providers)) {
    it.each(statuses)(
      `${provider.id}: HTTP %i`,
      async (status) => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => new Response(RESPONSE_BODY, { status })),
        );

        const error = await provider
          .complete({ system: 's', prompt: 'p', model: 'm' }, { apiKey: KEY })
          .then(
            () => null,
            (caught: unknown) => caught,
          );

        expect(isLLMError(error)).toBe(true);
        const text = JSON.stringify(error) + String(error) + (error as Error).message;
        expect(text).not.toContain(KEY);
        expect(text).not.toContain('provider echo');
        expect((error as Error).cause).toBeUndefined();
      },
      15_000,
    );

    it(`${provider.id}: lỗi mạng không mang key trong thông báo`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError(`Failed to fetch https://x/?key=${KEY}`);
        }),
      );

      const error = await provider
        .complete({ system: 's', prompt: 'p', model: 'm' }, { apiKey: KEY })
        .then(
          () => null,
          (caught: unknown) => caught,
        );

      expect(isLLMError(error)).toBe(true);
      expect((error as Error).message).not.toContain(KEY);
    });
  }
});

describe('thông báo lỗi tiếng Việt', () => {
  it('mỗi loại lỗi đều có câu là câu cố định không rỗng', () => {
    for (const message of Object.values(viText.aiErrorMessages)) {
      expect(message.trim().length).toBeGreaterThan(5);
    }
  });
});
