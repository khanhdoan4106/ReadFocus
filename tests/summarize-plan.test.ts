import { describe, expect, it } from 'vitest';
import type { LLMProvider } from '../src/core/llm/types';
import { resolveModel } from '../src/core/llm/models';
import type { TextPage } from '../src/core/summarize/chunk';
import {
  findCachedSummary,
  isFullyExtracted,
  planSummarizeAll,
  type SummaryConfig,
} from '../src/core/summarize/plan';
import { PROMPT_VERSION } from '../src/core/summarize/prompt';
import type { SummaryRecord } from '../src/core/summarize/record';
import { summarizeSection } from '../src/core/summarize/run';
import type { TocItem } from '../src/storage/db';

const config: SummaryConfig = { providerId: 'openai', model: 'm1', language: 'vi' };

function record(overrides: Partial<SummaryRecord> = {}): SummaryRecord {
  return {
    id: 'k',
    docId: 'd',
    startPage: 1,
    endPage: 2,
    title: 'Chương 1',
    providerId: 'openai',
    model: 'm1',
    promptVersion: PROMPT_VERSION,
    language: 'vi',
    summary: 's',
    keyPoints: [],
    terms: [],
    createdAt: 1,
    ...overrides,
  };
}

const section = { title: 'Chương 1', startPage: 1, endPage: 2 };
const pages: TextPage[] = [
  { page: 1, text: 'Nội dung trang một' },
  { page: 2, text: 'Nội dung trang hai' },
];

describe('findCachedSummary', () => {
  it('dùng lại bản khớp mọi yếu tố', () => {
    const hit = record();
    expect(findCachedSummary([hit], section, config, pages)).toBe(hit);
  });

  it.each([
    ['provider', { providerId: 'gemini' }],
    ['model', { model: 'm2' }],
    ['phiên bản prompt', { promptVersion: PROMPT_VERSION + 1 }],
    ['ngôn ngữ', { language: 'en' }],
    ['tiêu đề', { title: 'Chương khác' }],
    ['khoảng trang', { endPage: 3 }],
  ])('không dùng bản cũ khi khác %s', (_name, change) => {
    expect(findCachedSummary([record(change)], section, config, pages)).toBeUndefined();
  });

  it('ngôn ngữ "theo tài liệu" so với ngôn ngữ suy ra từ văn bản', () => {
    const english: TextPage[] = [
      { page: 1, text: 'The quick brown fox jumps over the lazy dog.' },
      { page: 2, text: 'This chapter introduces the main concepts of the book.' },
    ];
    const cfg: SummaryConfig = { ...config, language: 'document' };
    expect(findCachedSummary([record({ language: 'vi' })], section, cfg, english)).toBeUndefined();
    const hit = record({ language: 'en' });
    expect(findCachedSummary([hit], section, cfg, english)).toBe(hit);
  });
});

describe('resolveModel', () => {
  it('model rỗng dùng model mặc định của provider', () => {
    expect(resolveModel('openai', '  ')).toBe('gpt-6.1-sol');
    expect(resolveModel('openai', ' custom ')).toBe('custom');
  });
});

describe('isFullyExtracted', () => {
  it('chỉ đúng khi mọi trang của mục đã được trích', () => {
    expect(isFullyExtracted(section, pages)).toBe(true);
    expect(isFullyExtracted({ ...section, endPage: 3 }, pages)).toBe(false);
  });
});

describe('planSummarizeAll', () => {
  const items: TocItem[] = [
    { title: 'Chương 1', startPage: 1, endPage: 2, level: 1, wordCount: 6 },
    { title: 'Chương 2', startPage: 3, endPage: 4, level: 1, wordCount: 6 },
    { title: 'Chương 3', startPage: 5, endPage: 6, level: 1, wordCount: 0 },
    { title: 'Chương 4', startPage: 7, endPage: 8, level: 1, wordCount: 0 },
  ];
  const all: TextPage[] = [
    ...pages,
    { page: 3, text: 'Trang ba' },
    { page: 4, text: 'Trang bốn' },
    { page: 5, text: '' },
    { page: 6, text: '   ' },
  ];

  it('bỏ mục đã có cache, mục không có chữ và mục chưa được lập chỉ mục', () => {
    const plan = planSummarizeAll(items, all, [record()], config);
    expect(plan.todo.map((item) => item.title)).toEqual(['Chương 2']);
    expect(plan.cachedCount).toBe(1);
    expect(plan.estimate.requests).toBe(1);
  });

  it('cache của model khác không làm giảm ước lượng', () => {
    const plan = planSummarizeAll(items, all, [record({ model: 'old' })], config);
    expect(plan.todo.map((item) => item.title)).toEqual(['Chương 1', 'Chương 2']);
    expect(plan.estimate.requests).toBe(2);
  });

  it('ước lượng request bằng số request thật, kể cả request gộp map-reduce', async () => {
    const long = 'word '.repeat(4000);
    const longPages: TextPage[] = [
      { page: 1, text: long },
      { page: 2, text: long },
      { page: 3, text: long },
      { page: 4, text: 'ngắn' },
    ];
    const longItems: TocItem[] = [
      { title: 'Dài', startPage: 1, endPage: 3, level: 1, wordCount: 12000 },
      { title: 'Ngắn', startPage: 4, endPage: 4, level: 1, wordCount: 1 },
    ];
    const plan = planSummarizeAll(longItems, longPages, [], config);

    let calls = 0;
    const provider: LLMProvider = {
      id: 'openai',
      label: 'x',
      defaultModel: 'm1',
      defaultBaseUrl: '',
      async complete() {
        calls += 1;
        return '{"summary":"ok","keyPoints":[],"terms":[]}';
      },
      async checkConnection() {},
    };
    for (const item of plan.todo) {
      await summarizeSection({
        provider,
        config: { apiKey: 'k' },
        model: 'm1',
        kind: 'book',
        title: item.title,
        pages: longPages.filter((p) => p.page >= item.startPage && p.page <= item.endPage),
        language: 'vi',
      });
    }

    expect(plan.estimate.requests).toBeGreaterThan(2);
    expect(calls).toBe(plan.estimate.requests);
  });
});
