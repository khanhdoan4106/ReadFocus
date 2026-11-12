import { describe, expect, it } from 'vitest';
import {
  estimateSectionWork,
  estimateSpansWork,
  mapWithConcurrency,
  pagesInSpan,
} from '../src/core/summarize/work';
import { splitIntoChunks, type TextPage } from '../src/core/summarize/chunk';
import { estimateTokens } from '../src/core/summarize/tokens';

describe('pagesInSpan', () => {
  it('lọc đúng các trang thuộc khoảng [startPage, endPage]', () => {
    const pages: TextPage[] = [
      { page: 1, text: 'Trang 1' },
      { page: 2, text: 'Trang 2' },
      { page: 3, text: 'Trang 3' },
      { page: 5, text: 'Trang 5' },
    ];

    expect(pagesInSpan(pages, { startPage: 2, endPage: 3 })).toEqual([
      { page: 2, text: 'Trang 2' },
      { page: 3, text: 'Trang 3' },
    ]);
  });
});

describe('estimateSectionWork', () => {
  it('trả về 0 request khi không có trang', () => {
    expect(estimateSectionWork([])).toEqual({ requests: 0, inputTokens: 0 });
  });

  it('mục nằm trong ngân sách chỉ tốn 1 request', () => {
    const pages: TextPage[] = [{ page: 1, text: 'Short section text' }];
    const est = estimateSectionWork(pages, 100);
    expect(est).toEqual({ requests: 1, inputTokens: estimateTokens('Short section text') });
  });

  it('mục bị chia n đoạn tốn n + 1 request (n đoạn + 1 gộp)', () => {
    const longText = 'word '.repeat(300); // > 100 tokens
    const pages: TextPage[] = [
      { page: 1, text: longText },
      { page: 2, text: longText },
    ];
    const est = estimateSectionWork(pages, 100);
    const chunks = splitIntoChunks(pages, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(est.requests).toBe(chunks.length + 1);
    expect(est.inputTokens).toBe(chunks.reduce((sum, chunk) => sum + chunk.tokens, 0));
  });
});

describe('estimateSpansWork', () => {
  it('cộng dồn ước lượng của nhiều mục', () => {
    const pages: TextPage[] = [
      { page: 1, text: 'Section one' },
      { page: 2, text: 'Section two' },
    ];
    const spans = [
      { startPage: 1, endPage: 1 },
      { startPage: 2, endPage: 2 },
    ];

    const total = estimateSpansWork(spans, pages, 1000);
    expect(total).toEqual({
      requests: 2,
      inputTokens:
        estimateSectionWork([pages[0]!], 1000).inputTokens +
        estimateSectionWork([pages[1]!], 1000).inputTokens,
    });
  });
});

describe('mapWithConcurrency', () => {
  it('giữ đúng thứ tự kết quả', async () => {
    const items = [100, 10, 50];
    const res = await mapWithConcurrency(items, 2, async (item) => {
      await new Promise((r) => setTimeout(r, item));
      return item * 2;
    });

    expect(res).toEqual([200, 20, 100]);
  });

  it('tôn trọng giới hạn số công việc chạy song song', async () => {
    let running = 0;
    let maxRunning = 0;

    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running -= 1;
    });

    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it('dừng nhận việc mới khi AbortSignal bị huỷ', async () => {
    const controller = new AbortController();
    const executed: number[] = [];

    const promise = mapWithConcurrency(
      [1, 2, 3, 4, 5],
      1,
      async (item) => {
        executed.push(item);
        if (item === 2) controller.abort();
        return item;
      },
      controller.signal,
    );

    await expect(promise).rejects.toThrow();
    expect(executed).toEqual([1, 2]);
  });
});

describe('mapWithConcurrency khi một việc lỗi', () => {
  it('không worker nào nhận thêm mục sau khi có việc lỗi', async () => {
    const started: number[] = [];

    const promise = mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (item) => {
      started.push(item);
      if (item === 2) throw new Error('boom');
      await new Promise((r) => setTimeout(r, 20));
      return item;
    });

    await expect(promise).rejects.toThrow('boom');
    // Chờ đủ lâu để worker còn lại (đang chạy mục 1) có cơ hội lấy mục mới.
    await new Promise((r) => setTimeout(r, 80));
    expect(started).toEqual([1, 2]);
  });
});
