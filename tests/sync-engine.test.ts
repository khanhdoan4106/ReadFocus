import { beforeEach, describe, expect, it } from 'vitest';
import { PERSISTENT_FAILURES, ProgressSyncEngine } from '../src/core/sync/engine';
import {
  itemBytes,
  MAX_PROGRESS_ITEMS,
  planWrite,
  PROGRESS_BYTE_BUDGET,
  SYNC_LIMITS,
  WriteLimiter,
} from '../src/core/sync/plan';
import { isSyncKey, SYNC_VALUE_FIELDS, syncKey, type SyncRecord } from '../src/core/sync/record';
import { MockSyncArea } from './sync-mock';

let time = 1_800_000_000_000;
const clock = () => time;
const hash = (n: number) => n.toString(16).padStart(8, '0').padEnd(64, 'a');
const rec = (page: number, updatedAt: number, pageCount = 300): SyncRecord => ({
  page,
  pageCount,
  updatedAt,
});

let area: MockSyncArea;
let engine: ProgressSyncEngine;
beforeEach(() => {
  time = 1_800_000_000_000;
  area = new MockSyncArea(clock);
  engine = new ProgressSyncEngine(area, { now: clock });
});

describe('planWrite (LRU)', () => {
  it('bỏ tài liệu cũ nhất khi vượt số mục, không bao giờ bỏ mục vừa ghi', () => {
    const existing = Object.fromEntries(
      [1, 2, 3, 4].map((n) => [syncKey(hash(n)) as string, rec(1, n * 10)]),
    );
    const newKey = syncKey(hash(9)) as string;
    const plan = planWrite(existing, { [newKey]: rec(2, 1) }, 4);
    expect(plan.evict).toEqual([syncKey(hash(1))]);
    expect(Object.keys(plan.set)).toEqual([newKey]);
  });

  it('chỉ đụng khóa p:*, bỏ qua khóa khác', () => {
    const plan = planWrite(
      { autoOpenPdf: true as never, [syncKey(hash(1)) as string]: rec(1, 1) },
      { [syncKey(hash(2)) as string]: rec(1, 2) },
      1,
    );
    expect(plan.evict).toEqual([syncKey(hash(1))]);
  });

  it('cũng bỏ theo ngân sách byte', () => {
    const existing = Object.fromEntries(
      [1, 2, 3].map((n) => [syncKey(hash(n)) as string, rec(1, n)]),
    );
    const one = itemBytes(syncKey(hash(1)) as string, rec(1, 1));
    const plan = planWrite(
      existing,
      { [syncKey(hash(9)) as string]: rec(1, 99) },
      100,
      one * 2 + 5,
    );
    expect(plan.evict).toHaveLength(2);
  });
});

describe('WriteLimiter', () => {
  it('chừa dư so với 120/phút và 1.800/giờ của Chrome', () => {
    const limiter = new WriteLimiter();
    for (let i = 0; i < 100; i += 1) limiter.record(time);
    expect(limiter.canWrite(time)).toBe(false);
    expect(limiter.nextAllowedAt(time)).toBeGreaterThan(time);
    expect(limiter.canWrite(time + 61_000)).toBe(true);
  });

  it('hạn mức theo giờ', () => {
    const limiter = new WriteLimiter(100, 1500);
    for (let i = 0; i < 1500; i += 1) limiter.record(time - i * 2000);
    expect(limiter.canWrite(time)).toBe(false);
    expect(limiter.canWrite(time + 3_600_000)).toBe(true);
  });
});

describe('ProgressSyncEngine.flush', () => {
  it('gộp mọi thay đổi đang chờ thành MỘT lần ghi', async () => {
    for (let n = 1; n <= 20; n += 1) engine.queue(hash(n), rec(n, time + n));
    const result = await engine.flush();
    expect(result).toEqual({ ok: true, written: 20, evicted: 0 });
    expect(area.writes).toBe(1);
    expect(area.data.size).toBe(20);
    expect(engine.status()).toEqual({ state: 'idle' });
  });

  it('mỗi tài liệu chỉ giữ bản mới nhất trong hàng chờ', async () => {
    engine.queue(hash(1), rec(5, 100));
    engine.queue(hash(1), rec(9, 200));
    engine.queue(hash(1), rec(7, 150)); // cũ hơn: bỏ
    await engine.flush();
    expect(area.data.get(syncKey(hash(1)) as string)).toEqual(rec(9, 200));
  });

  it('CHỈ ghi khóa p:* với đúng ba trường; không đụng khóa khác; không lộ tên file/ghi chú', async () => {
    area.data.set('autoOpenPdf', true);
    const dirty = {
      ...rec(3, 10),
      name: 'bi-mat.pdf',
      note: 'ghi chú',
      apiKey: 'sk-x',
    } as SyncRecord;
    engine.queue(hash(1), dirty);
    await engine.flush();
    expect(area.data.get('autoOpenPdf')).toBe(true);
    for (const [key, value] of area.data) {
      if (key === 'autoOpenPdf') continue;
      expect(isSyncKey(key)).toBe(true);
      expect(Object.keys(value as object).sort()).toEqual([...SYNC_VALUE_FIELDS].sort());
    }
    expect(JSON.stringify([...area.data])).not.toMatch(/bi-mat|ghi chú|sk-x/);
  });

  it('docId không hợp lệ không vào hàng chờ', () => {
    expect(engine.queue('khong-hop-le', rec(1, 1))).toBe(false);
    expect(engine.pendingCount).toBe(0);
  });

  it('gần đầy thì bỏ các tài liệu cũ nhất (LRU), giữ dưới giới hạn thật của Chrome, không lỗi quota', async () => {
    // 450 tài liệu, ghi theo từng lô nhỏ: vượt 400 mục tiến độ thì phải bỏ bớt, không bao giờ chạm 512.
    for (let batch = 0; batch < 45; batch += 1) {
      for (let n = 0; n < 10; n += 1) {
        const id = batch * 10 + n + 1;
        engine.queue(hash(id), rec(1 + (id % 50), time + id));
      }
      const result = await engine.flush();
      expect(result.ok, `lô ${batch}`).toBe(true);
      time += 40_000; // dưới hạn mức nên không bị chặn
    }
    const keys = [...area.data.keys()].filter(isSyncKey);
    expect(keys.length).toBeLessThanOrEqual(MAX_PROGRESS_ITEMS);
    expect(area.data.size).toBeLessThanOrEqual(SYNC_LIMITS.maxItems);
    // Tài liệu cũ nhất đã bị bỏ, tài liệu mới nhất còn.
    expect(area.data.has(syncKey(hash(1)) as string)).toBe(false);
    expect(area.data.has(syncKey(hash(450)) as string)).toBe(true);
    const bytes = keys.reduce((sum, k) => sum + itemBytes(k, area.data.get(k)), 0);
    expect(bytes).toBeLessThanOrEqual(PROGRESS_BYTE_BUDGET);
  });

  it('không vượt hạn mức số lần ghi: bị chặn trước khi Chrome từ chối', async () => {
    let throttled = 0;
    let written = 0;
    for (let i = 0; i < 400; i += 1) {
      engine.queue(hash(1), rec(1 + (i % 100), time + i));
      const result = await engine.flush();
      if (result.ok) written += 1;
      else if (result.reason === 'throttled') {
        throttled += 1;
        expect(result.retryAt).toBeGreaterThan(time);
      } else throw new Error(`lỗi bất ngờ: ${result.reason}`);
      time += 100; // 400 lần trong 40 giây
    }
    expect(throttled).toBeGreaterThan(0);
    expect(area.writeTimes.filter((t) => t > time - 60_000).length).toBeLessThanOrEqual(
      SYNC_LIMITS.maxWritesPerMinute,
    );
    // Qua hạn mức thì ghi lại được và bản mới nhất được ghi.
    time += 120_000;
    const after = await engine.flush();
    expect(after.ok).toBe(true);
    expect(written).toBeGreaterThan(0);
  });

  it('bản đồng bộ mới hơn (ghi từ máy khác) không bị bản cũ trên máy này đè', async () => {
    area.data.set(syncKey(hash(1)) as string, rec(50, 5000));
    engine.queue(hash(1), rec(3, 1000));
    const result = await engine.flush();
    expect(result.ok).toBe(true);
    expect(area.data.get(syncKey(hash(1)) as string)).toEqual(rec(50, 5000));
  });
});

describe('lỗi quota và mất mạng', () => {
  it('lỗi thì giữ hàng chờ, im lặng thử lại sau với backoff tăng dần', async () => {
    engine.queue(hash(1), rec(2, 10));
    area.failNext = new Error('Quota exceeded: QUOTA_BYTES');
    const first = await engine.flush();
    expect(first).toMatchObject({ ok: false, reason: 'error' });
    expect(engine.pendingCount).toBe(1);
    expect(engine.status().state).toBe('retrying');

    // Chưa tới giờ thử lại: không gọi lại.
    const early = await engine.flush();
    expect(early).toMatchObject({ ok: false, reason: 'throttled' });

    time = (first as { retryAt: number }).retryAt + 1;
    area.failNext = new Error('offline');
    const second = await engine.flush();
    const gap1 =
      (first as { retryAt: number }).retryAt -
      (time - ((first as { retryAt: number }).retryAt + 1 - 0) + 0);
    expect(gap1).toBeDefined();
    expect((second as { retryAt: number }).retryAt - time).toBeGreaterThan(30_000);

    // Phục hồi: ghi được và mọi trạng thái lỗi được xoá.
    time = (second as { retryAt: number }).retryAt + 1;
    const ok = await engine.flush();
    expect(ok.ok).toBe(true);
    expect(engine.status()).toEqual({ state: 'idle' });
    expect(engine.isFailingPersistently()).toBe(false);
  });

  it('lỗi kéo dài (liên tiếp nhiều lần) mới được coi là kéo dài', async () => {
    engine.queue(hash(1), rec(2, 10));
    area.offline = true;
    for (let i = 0; i < PERSISTENT_FAILURES; i += 1) {
      expect(engine.isFailingPersistently()).toBe(i >= PERSISTENT_FAILURES);
      const result = await engine.flush();
      expect(result.ok).toBe(false);
      time = (result as { retryAt: number }).retryAt + 1;
    }
    expect(engine.isFailingPersistently()).toBe(true);
  });

  it('flush không bao giờ ném lỗi ra ngoài', async () => {
    engine.queue(hash(1), rec(2, 10));
    area.offline = true;
    await expect(engine.flush()).resolves.toMatchObject({ ok: false });
  });
});

describe('đọc và xoá', () => {
  it('read trả bản hợp lệ; hỏng, thiếu hoặc lỗi đọc thì null', async () => {
    area.data.set(syncKey(hash(1)) as string, rec(4, 10));
    area.data.set(syncKey(hash(2)) as string, { page: 'x' });
    expect(await engine.read(hash(1))).toEqual(rec(4, 10));
    expect(await engine.read(hash(2))).toBeNull();
    expect(await engine.read(hash(3))).toBeNull();
    expect(await engine.read('khong-hop-le')).toBeNull();
    area.offline = true;
    expect(await engine.read(hash(1))).toBeNull();
  });

  it('clearSynced chỉ xoá các khóa p:*, giữ autoOpenPdf và khóa lạ', async () => {
    area.data.set('autoOpenPdf', true);
    area.data.set('khoa-la', 1);
    for (let n = 1; n <= 3; n += 1) area.data.set(syncKey(hash(n)) as string, rec(1, n));
    engine.queue(hash(9), rec(1, 1)); // hàng chờ cũng bị bỏ
    expect(await engine.clearSynced()).toBe(3);
    expect([...area.data.keys()].sort()).toEqual(['autoOpenPdf', 'khoa-la']);
    expect(engine.pendingCount).toBe(0);
  });
});
