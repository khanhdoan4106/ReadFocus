import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUT_TOKEN_BUDGET,
  splitIntoChunks,
  type TextPage,
} from '../src/core/summarize/chunk';
import { summaryCacheInput, summaryCacheKey } from '../src/core/summarize/cache-key';
import { parseSummaryResponse } from '../src/core/summarize/parse';
import {
  buildMergePrompt,
  buildSummaryPrompt,
  PROMPT_VERSION,
  resolveOutputLanguage,
} from '../src/core/summarize/prompt';
import { estimateTokens, looksVietnamese } from '../src/core/summarize/tokens';

describe('estimateTokens', () => {
  it('văn bản rỗng có 0 token', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('tiếng Anh ước lượng 4 ký tự mỗi token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('tiếng Việt ước lượng 3 ký tự mỗi token', () => {
    expect(estimateTokens('Chương trình')).toBe(4);
    expect(estimateTokens('đây là tiếng Việt')).toBe(6);
  });
});

describe('looksVietnamese', () => {
  it('nhận ra chữ có dấu đặc trưng', () => {
    expect(looksVietnamese('Chương 1')).toBe(true);
    expect(looksVietnamese('Đường phố')).toBe(true);
    expect(looksVietnamese('Tiếng Việt')).toBe(true);
  });

  it('không nhầm văn bản tiếng Anh', () => {
    expect(looksVietnamese('Chapter 1')).toBe(false);
    expect(looksVietnamese('Hello world')).toBe(false);
    expect(looksVietnamese('')).toBe(false);
  });
});

describe('splitIntoChunks', () => {
  const pages: TextPage[] = [
    { page: 1, text: 'aaaa\n\nbbbb' },
    { page: 2, text: 'cccc' },
  ];

  it('gộp các đoạn vừa ngân sách và giữ số trang', () => {
    const chunks = splitIntoChunks(pages, DEFAULT_INPUT_TOKEN_BUDGET);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.pages).toEqual([1, 2]);
    expect(chunks[0]?.text).toBe('aaaa\n\nbbbb\n\ncccc');
    expect(chunks[0]?.tokens).toBe(estimateTokens(chunks[0]?.text ?? ''));
  });

  it('tách đoạn khi vượt ngân sách', () => {
    const chunks = splitIntoChunks(pages, 2);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.pages)).toEqual([[1], [1], [2]]);
    expect(chunks.map((chunk) => chunk.text)).toEqual(['aaaa', 'bbbb', 'cccc']);
  });

  it('bỏ trang không có chữ', () => {
    const chunks = splitIntoChunks([
      { page: 1, text: '   \n\n  ' },
      { page: 2, text: 'nội dung' },
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.pages).toEqual([2]);
    expect(chunks[0]?.text).toBe('nội dung');
  });

  it('cắt đoạn quá dài theo ranh giới từ', () => {
    const longText = 'word '.repeat(100).trim();
    const chunks = splitIntoChunks([{ page: 5, text: longText }], 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.pages).toEqual([5]);
      expect(chunk.tokens).toBeLessThanOrEqual(100);
    }
    expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(longText);
  });

  it('cắt văn bản tiếng Việt dài', () => {
    const longText = 'chữ '.repeat(200).trim();
    const chunks = splitIntoChunks([{ page: 3, text: longText }], 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.pages).toEqual([3]);
      expect(chunk.tokens).toBeLessThanOrEqual(100);
    }
  });

  it('ngân sách hỏng vẫn trả về đoạn thay vì treo', () => {
    expect(splitIntoChunks(pages, 0).length).toBeGreaterThan(0);
    expect(splitIntoChunks(pages, Number.NaN).length).toBeGreaterThan(0);
    expect(splitIntoChunks([], 100)).toEqual([]);
  });
});

describe('parseSummaryResponse', () => {
  const range = { startPage: 2, endPage: 10 };

  it('đọc JSON đúng cấu trúc', () => {
    const raw = JSON.stringify({
      summary: '  Tóm tắt  ',
      keyPoints: [{ text: ' Ý chính ', pages: [3, 2] }],
      terms: [{ term: ' Khái niệm ', definition: ' Định nghĩa ' }],
    });
    expect(parseSummaryResponse(raw, range)).toEqual({
      summary: 'Tóm tắt',
      keyPoints: [{ text: 'Ý chính', pages: [2, 3] }],
      terms: [{ term: 'Khái niệm', definition: 'Định nghĩa' }],
    });
  });

  it('bỏ JSON bọc trong markdown fence', () => {
    const raw = ['```json', '{"summary":"Nội dung","keyPoints":[],"terms":[]}', '```'].join('\n');
    expect(parseSummaryResponse(raw, range).summary).toBe('Nội dung');
  });

  it('bỏ số trang ngoài phạm vi mục và số không hợp lệ', () => {
    const raw = JSON.stringify({
      summary: 'Tóm tắt',
      keyPoints: [{ text: 'Ý', pages: [1, 2, 2, 10, 11, 3.5, '4'] }],
      terms: [],
    });
    expect(parseSummaryResponse(raw, range).keyPoints[0]?.pages).toEqual([2, 10]);
  });

  it('JSON lỗi thì coi toàn bộ câu trả lời là summary', () => {
    const raw = 'Đây là câu trả lời không phải JSON.';
    expect(parseSummaryResponse(raw, range)).toEqual({
      summary: raw,
      keyPoints: [],
      terms: [],
    });
  });

  it('JSON thiếu nội dung thì giữ câu trả lời gốc', () => {
    const raw = '{"summary":"","keyPoints":[]}';
    expect(parseSummaryResponse(raw, range).summary).toBe(raw);
  });

  it('bỏ mục thiếu trường bắt buộc', () => {
    const raw = JSON.stringify({
      summary: 'Tóm tắt',
      keyPoints: [{ text: '', pages: [2] }, { pages: [3] }, { text: 'Hợp lệ' }],
      terms: [{ term: 'A' }, { definition: 'B' }, { term: 'C', definition: 'D' }],
    });
    const parsed = parseSummaryResponse(raw, range);
    expect(parsed.keyPoints).toEqual([{ text: 'Hợp lệ', pages: [] }]);
    expect(parsed.terms).toEqual([{ term: 'C', definition: 'D' }]);
  });

  it('câu trả lời rỗng cho kết quả rỗng', () => {
    expect(parseSummaryResponse('   ', range)).toEqual({
      summary: '',
      keyPoints: [],
      terms: [],
    });
  });
});

describe('resolveOutputLanguage', () => {
  it('mặc định tiếng Việt', () => {
    expect(resolveOutputLanguage('vi', 'Chapter 1')).toBe('vi');
  });

  it('theo ngôn ngữ tài liệu', () => {
    expect(resolveOutputLanguage('document', 'Chương 1: Mở đầu')).toBe('vi');
    expect(resolveOutputLanguage('document', 'Chapter 1: Introduction')).toBe('en');
  });
});

describe('prompt', () => {
  it('có phiên bản prompt để vô hiệu cache cũ', () => {
    expect(Number.isInteger(PROMPT_VERSION)).toBe(true);
    expect(PROMPT_VERSION).toBeGreaterThan(0);
  });

  it('prompt sách nhấn mạnh ý chính, lập luận, ví dụ', () => {
    const prompt = buildSummaryPrompt({
      kind: 'book',
      title: 'Chương 2',
      text: 'Nội dung chương.',
      language: 'vi',
    });
    expect(prompt.prompt).toContain('a book chapter');
    expect(prompt.prompt).toContain('the argument');
    expect(prompt.prompt).toContain('important examples');
    expect(prompt.prompt).toContain('Chương 2');
    expect(prompt.prompt).toContain('"keyPoints"');
    expect(prompt.prompt).toContain('<<<');
    expect(prompt.system).toContain('untrusted data');
  });

  it('prompt paper hỏi vấn đề, phương pháp, kết quả, hạn chế', () => {
    const prompt = buildSummaryPrompt({
      kind: 'paper',
      title: 'Abstract',
      text: 'This paper studies things.',
      language: 'document',
    });
    expect(prompt.prompt).toContain('the problem, method, results, and limitations');
    expect(prompt.prompt).toContain('the same language as the document text');
  });

  it('prompt slides gom ý theo chủ đề', () => {
    const prompt = buildSummaryPrompt({
      kind: 'slides',
      title: 'Bài 4',
      text: 'Slide nội dung.',
      language: 'vi',
    });
    expect(prompt.prompt).toContain('grouped by topic');
  });

  it('ghi nhãn phần khi mục được chia nhỏ', () => {
    const prompt = buildSummaryPrompt({
      kind: 'unknown',
      title: 'Mục',
      text: 'Nội dung.',
      language: 'vi',
      partLabel: 'phần 2/5',
    });
    expect(prompt.prompt).toContain('(phần 2/5)');
  });

  it('prompt gộp giữ số trang của từng phần', () => {
    const prompt = buildMergePrompt({
      kind: 'paper',
      title: 'Kết luận',
      language: 'document',
      sampleText: 'Văn bản tiếng Việt.',
      partials: [
        { summary: 'Phần đầu', pages: [1, 2] },
        { summary: 'Phần sau', pages: [] },
      ],
    });
    expect(prompt.prompt).toContain('Part 1 (pages 1, 2):');
    expect(prompt.prompt).toContain('Part 2 (pages unknown):');
    expect(prompt.prompt).toContain('Vietnamese');
    expect(prompt.prompt).toContain('"terms"');
  });
});

describe('summaryCacheKey', () => {
  const parts = {
    docId: 'abc123',
    startPage: 2,
    endPage: 9,
    title: 'Chương 2',
    providerId: 'openai',
    model: 'gpt-test',
    promptVersion: PROMPT_VERSION,
    language: 'vi' as const,
  };

  it('ổn định với cùng đầu vào', async () => {
    const first = await summaryCacheKey(parts);
    const second = await summaryCacheKey({ ...parts });
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('bỏ khoảng trắng thừa ở tiêu đề và model', async () => {
    const base = await summaryCacheKey(parts);
    expect(await summaryCacheKey({ ...parts, title: '  Chương 2  ', model: ' gpt-test ' })).toBe(
      base,
    );
  });

  it('đổi bất kỳ yếu tố nào cũng đổi khoá', async () => {
    const base = await summaryCacheKey(parts);
    const variants = [
      { ...parts, docId: 'abc124' },
      { ...parts, startPage: 3 },
      { ...parts, endPage: 10 },
      { ...parts, title: 'Chương 3' },
      { ...parts, providerId: 'gemini' },
      { ...parts, model: 'gpt-other' },
      { ...parts, promptVersion: PROMPT_VERSION + 1 },
      { ...parts, language: 'en' as const },
    ];
    for (const variant of variants) {
      expect(await summaryCacheKey(variant)).not.toBe(base);
    }
  });

  it('chuỗi đầu vào tách trường bằng NUL', () => {
    const input = summaryCacheInput(parts);
    expect(input.split('\u0000')).toEqual([
      'abc123',
      '2',
      '9',
      'Chương 2',
      'openai',
      'gpt-test',
      String(PROMPT_VERSION),
      'vi',
    ]);
  });
});
