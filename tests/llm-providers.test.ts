import { afterEach, describe, expect, it, vi } from 'vitest';
import { anthropicProvider } from '../src/core/llm/anthropic';
import { LLMError } from '../src/core/llm/errors';
import { geminiProvider } from '../src/core/llm/gemini';
import { normalizeBaseUrl } from '../src/core/llm/http';
import { getProvider, providers } from '../src/core/llm/index';
import { DEFAULT_MODELS } from '../src/core/llm/models';
import { openaiProvider } from '../src/core/llm/openai';
import { openAiCompatibleProvider } from '../src/core/llm/openai-compatible';
import anthropicError from './fixtures/llm/anthropic-error.json';
import anthropicSuccess from './fixtures/llm/anthropic-success.json';
import geminiError from './fixtures/llm/gemini-error.json';
import geminiSuccess from './fixtures/llm/gemini-success.json';
import openaiError from './fixtures/llm/openai-error.json';
import openaiSuccess from './fixtures/llm/openai-success.json';

const OPENAI_TEXT =
  '{"summary":"Tóm tắt chương thử nghiệm","keyPoints":[{"text":"Ý chính","pages":[2,3]}],"terms":[{"term":"Thuật ngữ","definition":"Định nghĩa"}]}';
const GEMINI_TEXT =
  '{"summary":"Tóm tắt chương","keyPoints":[{"text":"Ý chính","pages":[2]}],"terms":[]}';
const ANTHROPIC_TEXT = '{"summary":"Tóm tắt","keyPoints":[{"text":"Ý","pages":[4]}],"terms":[]}';

const request = {
  system: 'Bạn là trợ lý tóm tắt.',
  prompt: 'Nội dung cần tóm tắt.',
  model: 'test-model',
  maxTokens: 123,
};

const config = { apiKey: 'test-key' };

function installFetch() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** `Response` chỉ đọc body một lần, nên mỗi lần thử lại phải tạo response mới. */
function responseFactory(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): () => Response {
  return () => jsonResponse(body, status, headers);
}

function firstCall(fetchMock: ReturnType<typeof installFetch>) {
  const [call] = fetchMock.mock.calls;
  if (call === undefined) throw new Error('fetch chưa được gọi');
  const [url, init] = call as [string, RequestInit];
  return {
    url,
    init,
    headers: new Headers(init.headers),
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('openaiProvider', () => {
  it('gửi đúng endpoint, header và body rồi đọc nội dung', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(openaiSuccess));

    await expect(openaiProvider.complete(request, config)).resolves.toBe(OPENAI_TEXT);

    const call = firstCall(fetchMock);
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(call.init.method).toBe('POST');
    expect(call.headers.get('authorization')).toBe('Bearer test-key');
    expect(call.body.model).toBe('test-model');
    expect(call.body.max_completion_tokens).toBe(123);
    expect(call.body.messages).toEqual([
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ]);
  });

  it('đọc được content dạng mảng text', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'A' },
                { type: 'text', text: 'B' },
              ],
            },
          },
        ],
      }),
    );

    await expect(openaiProvider.complete(request, config)).resolves.toBe('AB');
  });

  it('kiểm tra kết nối chỉ gửi request rất nhỏ', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));

    await expect(openaiProvider.checkConnection(config, 'test-model')).resolves.toBeUndefined();

    const call = firstCall(fetchMock);
    expect(call.body.max_completion_tokens).toBe(8);
    expect(JSON.stringify(call.body)).not.toContain(request.prompt);
  });

  it('key rỗng báo invalid-key mà không gọi mạng', async () => {
    const fetchMock = installFetch();
    await expect(openaiProvider.complete(request, { apiKey: '   ' })).rejects.toMatchObject({
      kind: 'invalid-key',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('geminiProvider', () => {
  it('gửi đúng endpoint, header và body; bỏ phần thought', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(geminiSuccess));

    await expect(geminiProvider.complete(request, config)).resolves.toBe(GEMINI_TEXT);

    const call = firstCall(fetchMock);
    expect(call.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent',
    );
    expect(call.headers.get('x-goog-api-key')).toBe('test-key');
    expect(call.body.systemInstruction).toEqual({ parts: [{ text: request.system }] });
    expect(call.body.contents).toEqual([{ role: 'user', parts: [{ text: request.prompt }] }]);
    expect(call.body.generationConfig).toEqual({ maxOutputTokens: 123 });
  });

  it('báo bad-response khi prompt bị chặn', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }));

    await expect(geminiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'bad-response',
      message: 'Blocked: SAFETY',
    });
  });

  it('báo quota khi 429 nói về hạn mức', async () => {
    const fetchMock = installFetch();
    fetchMock.mockImplementation(responseFactory(geminiError, 429, { 'retry-after': '0' }));

    await expect(geminiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'quota',
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('kiểm tra kết nối dùng model người dùng chọn', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));

    await geminiProvider.checkConnection(config, 'gemini-test');
    const call = firstCall(fetchMock);
    expect(call.url).toContain('/models/gemini-test:generateContent');
  });
});

describe('anthropicProvider', () => {
  it('gửi đúng header trình duyệt và đọc các block text', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(anthropicSuccess));

    await expect(anthropicProvider.complete(request, config)).resolves.toBe(ANTHROPIC_TEXT);

    const call = firstCall(fetchMock);
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers.get('x-api-key')).toBe('test-key');
    expect(call.headers.get('anthropic-version')).toBe('2023-06-01');
    expect(call.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(call.body.max_tokens).toBe(123);
    expect(call.body.system).toBe(request.system);
    expect(call.body.messages).toEqual([{ role: 'user', content: request.prompt }]);
  });

  it('429 đọc đúng lỗi rate-limit', async () => {
    const fetchMock = installFetch();
    fetchMock.mockImplementation(responseFactory(anthropicError, 429, { 'retry-after': '0' }));

    await expect(anthropicProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'rate-limit',
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('kiểm tra kết nối không gửi nội dung tài liệu', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));

    await anthropicProvider.checkConnection({ apiKey: 'key-test' }, 'claude-test');
    const call = firstCall(fetchMock);
    expect(call.body.max_tokens).toBe(8);
    expect(String(call.body.messages)).not.toContain(request.prompt);
  });
});

describe('openAiCompatibleProvider', () => {
  it('dùng base URL người dùng nhập và max_tokens', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(openaiSuccess));

    const text = await openAiCompatibleProvider.complete(request, {
      apiKey: 'local-key',
      baseUrl: 'http://localhost:1234/v1/',
    });

    expect(text).toBe(OPENAI_TEXT);
    const call = firstCall(fetchMock);
    expect(call.url).toBe('http://localhost:1234/v1/chat/completions');
    expect(call.body.max_tokens).toBe(123);
    expect(call.body.max_completion_tokens).toBeUndefined();
    expect(call.headers.get('authorization')).toBe('Bearer local-key');
  });

  it('dùng base URL mặc định khi người dùng để trống', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(openaiSuccess));

    await openAiCompatibleProvider.complete(request, { apiKey: 'local-key' });
    expect(firstCall(fetchMock).url).toBe('http://localhost:11434/v1/chat/completions');
  });
});

describe('normalizeBaseUrl', () => {
  it('bỏ dấu / cuối và thêm /v1 khi thiếu đường dẫn', () => {
    expect(normalizeBaseUrl('http://localhost:11434', 'http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1',
    );
    expect(normalizeBaseUrl('http://localhost:11434/v1/', 'http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1',
    );
    expect(
      normalizeBaseUrl('https://gateway.example.com/openai/v1/', 'http://localhost:11434/v1'),
    ).toBe('https://gateway.example.com/openai/v1');
  });

  it('dùng fallback khi để trống', () => {
    expect(normalizeBaseUrl('   ', 'http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
  });

  it('từ chối URL sai hoặc giao thức khác', () => {
    expect(() => normalizeBaseUrl('không phải url', 'http://localhost:11434/v1')).toThrow(LLMError);
    expect(() => normalizeBaseUrl('ftp://example.com', 'http://localhost:11434/v1')).toThrow(
      LLMError,
    );
  });
});

describe('lỗi mạng và lỗi HTTP', () => {
  it('401 thành invalid-key', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(openaiError, 401));

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'invalid-key',
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('thử lại 429 rồi thành công', async () => {
    const fetchMock = installFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(openaiError, 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(openaiSuccess));

    await expect(openaiProvider.complete(request, config)).resolves.toBe(OPENAI_TEXT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('chỉ thử lại 429 tối đa 2 lần', async () => {
    const fetchMock = installFetch();
    fetchMock.mockImplementation(
      responseFactory({ error: { message: 'rate limited' } }, 429, {
        'retry-after': '0',
      }),
    );

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'rate-limit',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('429 nói về quota thành quota', async () => {
    const fetchMock = installFetch();
    fetchMock.mockImplementation(
      responseFactory({ error: { message: 'insufficient_quota' } }, 429, {
        'retry-after': '0',
      }),
    );

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'quota',
    });
  });

  it('backoff 500 ms khi không có Retry-After', async () => {
    const fetchMock = installFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(openaiError, 429))
      .mockResolvedValueOnce(jsonResponse(openaiSuccess));

    vi.useFakeTimers();
    const promise = openaiProvider.complete(request, config);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBe(OPENAI_TEXT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lỗi 500 thành unknown và không thử lại', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: {} }, 500));

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'unknown',
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('JSON hỏng trong response 2xx thành bad-response', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse('không phải JSON', 200));

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });

  it('nội dung rỗng thành bad-response', async () => {
    const fetchMock = installFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: '   ' } }] }));

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });

  it('fetch lỗi mạng thành network', async () => {
    const fetchMock = installFetch();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('fetch bị huỷ thành cancelled', async () => {
    const fetchMock = installFetch();
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

    await expect(openaiProvider.complete(request, config)).rejects.toMatchObject({
      kind: 'cancelled',
    });
  });

  it('signal đã huỷ trước khi gọi thì không gửi request', async () => {
    const fetchMock = installFetch();
    const controller = new AbortController();
    controller.abort();

    await expect(
      openaiProvider.complete(request, config, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'cancelled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('danh sách provider', () => {
  it('có đủ 4 provider, model mặc định khớp bảng hằng số', () => {
    expect(providers.map((provider) => provider.id)).toEqual([
      'openai',
      'gemini',
      'anthropic',
      'openai-compatible',
    ]);

    for (const provider of providers) {
      expect(provider.defaultModel).toBe(DEFAULT_MODELS[provider.id]);
      expect(provider.defaultModel).not.toBe('');
      expect(getProvider(provider.id)).toBe(provider);
    }
  });
});
