import { describe, expect, it } from 'vitest';
import { LLMError } from '../src/core/llm/errors';
import { isItemLevelError, runSummaryBatch } from '../src/core/summarize/batch';

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('runSummaryBatch', () => {
  it('lỗi nặng ở mục 2 thì không có request nào cho các mục sau', async () => {
    const requested: number[] = [];
    const ac = new AbortController();

    const result = await runSummaryBatch({
      items: [1, 2, 3, 4, 5, 6],
      concurrency: 2,
      signal: ac.signal,
      worker: async (item, signal) => {
        requested.push(item);
        if (item === 2) throw new LLMError('invalid-key', 'x');
        await tick(20);
        signal.throwIfAborted();
      },
    });
    await tick(60);

    expect(requested).toEqual([1, 2]);
    expect(result.fatal).toBeInstanceOf(LLMError);
    expect(result.cancelled).toBe(false);
  });

  it('abort tín hiệu của worker đang chạy khi gặp lỗi nặng', async () => {
    let seenAbort = false;
    await runSummaryBatch({
      items: [1, 2],
      concurrency: 2,
      signal: new AbortController().signal,
      worker: async (item, signal) => {
        if (item === 1) {
          await new Promise<void>((resolve) =>
            signal.addEventListener('abort', () => {
              seenAbort = true;
              resolve();
            }),
          );
          return;
        }
        throw new LLMError('quota', 'x');
      },
    });
    expect(seenAbort).toBe(true);
  });

  it('lỗi riêng của một mục thì các mục khác vẫn xong', async () => {
    const done: number[] = [];

    const result = await runSummaryBatch({
      items: [1, 2, 3, 4],
      concurrency: 2,
      signal: new AbortController().signal,
      worker: async (item) => {
        if (item === 2) throw new LLMError('truncated', 'x');
        done.push(item);
      },
    });

    expect(done.sort()).toEqual([1, 3, 4]);
    expect(result.failed.map((f) => f.item)).toEqual([2]);
    expect(result.fatal).toBeUndefined();
  });

  it('huỷ giữa chừng thì dừng nhận mục mới và báo cancelled', async () => {
    const ac = new AbortController();
    const started: number[] = [];

    const result = await runSummaryBatch({
      items: [1, 2, 3, 4],
      concurrency: 1,
      signal: ac.signal,
      worker: async (item) => {
        started.push(item);
        if (item === 2) ac.abort();
      },
    });

    expect(started).toEqual([1, 2]);
    expect(result.cancelled).toBe(true);
    expect(result.fatal).toBeUndefined();
  });
});

describe('isItemLevelError', () => {
  it('chỉ truncated, bad-response, context-too-long là lỗi riêng của mục', () => {
    expect(isItemLevelError(new LLMError('truncated', ''))).toBe(true);
    expect(isItemLevelError(new LLMError('bad-response', ''))).toBe(true);
    expect(isItemLevelError(new LLMError('context-too-long', ''))).toBe(true);
    expect(isItemLevelError(new LLMError('invalid-key', ''))).toBe(false);
    expect(isItemLevelError(new LLMError('rate-limit', ''))).toBe(false);
    expect(isItemLevelError(new Error('x'))).toBe(false);
  });
});
