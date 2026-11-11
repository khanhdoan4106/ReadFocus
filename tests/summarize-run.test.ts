import { describe, expect, it } from 'vitest';
import { LLMError } from '../src/core/llm/errors';
import type { LLMProvider, ProviderConfig } from '../src/core/llm/types';
import type { TextPage } from '../src/core/summarize/chunk';
import { summarizeSection } from '../src/core/summarize/run';

function makeMockProvider(responder: (prompt: string) => string): LLMProvider {
  return {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    async complete(request) {
      return responder(request.prompt);
    },
    async checkConnection() {},
  };
}

const dummyConfig: ProviderConfig = { apiKey: 'test-key' };

describe('summarizeSection', () => {
  it('trả về kết quả rỗng cho mục không có chữ', async () => {
    const provider = makeMockProvider(() => '{}');
    const res = await summarizeSection({
      provider,
      config: dummyConfig,
      model: 'gpt-4o-mini',
      kind: 'book',
      title: 'Chương 1',
      pages: [],
      language: 'vi',
    });

    expect(res).toEqual({
      summary: '',
      keyPoints: [],
      terms: [],
      requests: 0,
      inputTokens: 0,
      reduced: false,
    });
  });

  it('gọi 1 request duy nhất với mục nhỏ hơn ngân sách token', async () => {
    const calls: string[] = [];
    const provider = makeMockProvider((prompt) => {
      calls.push(prompt);
      return JSON.stringify({
        summary: 'Tóm tắt ngắn gọn.',
        keyPoints: [{ text: 'Ý 1', pages: [1] }],
        terms: [],
      });
    });

    const pages: TextPage[] = [{ page: 1, text: 'Nội dung ngắn.' }];
    const res = await summarizeSection({
      provider,
      config: dummyConfig,
      model: 'gpt-4o-mini',
      kind: 'book',
      title: 'Giới thiệu',
      pages,
      language: 'vi',
      maxInputTokens: 1000,
    });

    expect(calls.length).toBe(1);
    expect(res.requests).toBe(1);
    expect(res.reduced).toBe(false);
    expect(res.summary).toBe('Tóm tắt ngắn gọn.');
    expect(res.keyPoints).toEqual([{ text: 'Ý 1', pages: [1] }]);
  });

  it('gọi map-reduce hai tầng cho mục dài vượt ngân sách token', async () => {
    const prompts: string[] = [];
    const provider = makeMockProvider((prompt) => {
      prompts.push(prompt);
      if (prompt.includes('Merge the partial summaries')) {
        return JSON.stringify({
          summary: 'Tóm tắt tổng hợp.',
          keyPoints: [
            { text: 'Ý phần 1', pages: [1] },
            { text: 'Ý phần 2', pages: [2] },
          ],
          terms: [],
        });
      }
      return JSON.stringify({
        summary: 'Tóm tắt một phần.',
        keyPoints: [{ text: 'Ý nhỏ', pages: [1] }],
        terms: [],
      });
    });

    const pages: TextPage[] = [
      { page: 1, text: 'word '.repeat(50) }, // ~62 tokens
      { page: 2, text: 'test '.repeat(50) }, // ~62 tokens
    ];

    const res = await summarizeSection({
      provider,
      config: dummyConfig,
      model: 'gpt-4o-mini',
      kind: 'paper',
      title: 'Phương pháp',
      pages,
      language: 'vi',
      maxInputTokens: 80, // Cố tình thấp hơn tổng 124 tokens để chia đúng 2 đoạn
    });

    expect(res.reduced).toBe(true);
    expect(res.requests).toBe(3); // 2 chunk requests + 1 merge request
    expect(prompts.length).toBe(3);
    expect(prompts[2]).toContain('Merge the partial summaries');
    expect(res.summary).toBe('Tóm tắt tổng hợp.');
    expect(res.keyPoints.length).toBe(2);
  });

  it('truyền lỗi truncated từ provider', async () => {
    const provider: LLMProvider = {
      id: 'openai',
      label: 'OpenAI',
      defaultModel: 'gpt-4o-mini',
      defaultBaseUrl: 'https://api.openai.com/v1',
      async complete() {
        throw new LLMError('truncated', 'Output truncated');
      },
      async checkConnection() {},
    };

    const pages: TextPage[] = [{ page: 1, text: 'Một đoạn văn.' }];
    await expect(
      summarizeSection({
        provider,
        config: dummyConfig,
        model: 'gpt-4o-mini',
        kind: 'book',
        title: 'Lỗi',
        pages,
        language: 'vi',
      }),
    ).rejects.toThrowError(LLMError);
  });

  it('huỷ cuộc gọi ở giữa khi AbortSignal bị huỷ', async () => {
    const controller = new AbortController();
    let callCount = 0;
    const provider = makeMockProvider(() => {
      callCount += 1;
      controller.abort(); // Huỷ ngay sau request đầu tiên
      return JSON.stringify({ summary: 'Phần 1', keyPoints: [], terms: [] });
    });

    const pages: TextPage[] = [
      { page: 1, text: 'Đoạn 1 '.repeat(100) },
      { page: 2, text: 'Đoạn 2 '.repeat(100) },
    ];

    await expect(
      summarizeSection({
        provider,
        config: dummyConfig,
        model: 'gpt-4o-mini',
        kind: 'slides',
        title: 'Slide deck',
        pages,
        language: 'vi',
        maxInputTokens: 100,
        signal: controller.signal,
      }),
    ).rejects.toThrow();

    expect(callCount).toBe(1); // Không gọi các request tiếp theo
  });
});
