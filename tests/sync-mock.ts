import type { SyncArea } from '../src/core/sync/engine';
import { SYNC_LIMITS } from '../src/core/sync/plan';

/**
 * `chrome.storage.sync` giả có mô phỏng quota đúng như tài liệu của Chrome: 512 mục, 8.192 byte
 * mỗi mục, 102.400 byte tổng (JSON của giá trị cộng độ dài khóa), 120 lần ghi mỗi phút và 1.800
 * mỗi giờ (set và remove đều là một lần ghi). Vượt thì ném lỗi như Chrome.
 */
export class MockSyncArea implements SyncArea {
  data = new Map<string, unknown>();
  writeTimes: number[] = [];
  /** Số lệnh ghi đã thành công, để test kiểm tra "một lô = một lần ghi". */
  writes = 0;
  failNext: Error | null = null;
  offline = false;

  constructor(private readonly clock: () => number) {}

  private bytes(map: Map<string, unknown>): number {
    let total = 0;
    for (const [key, value] of map) total += key.length + JSON.stringify(value).length;
    return total;
  }

  private checkRate(): void {
    const now = this.clock();
    this.writeTimes = this.writeTimes.filter((t) => t > now - 3_600_000);
    if (this.writeTimes.filter((t) => t > now - 60_000).length >= SYNC_LIMITS.maxWritesPerMinute) {
      throw new Error('This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.');
    }
    if (this.writeTimes.length >= SYNC_LIMITS.maxWritesPerHour) {
      throw new Error('This request exceeds the MAX_WRITE_OPERATIONS_PER_HOUR quota.');
    }
  }

  async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    if (this.offline) throw new Error('offline');
    const wanted = keys === null ? [...this.data.keys()] : Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      wanted.filter((k) => this.data.has(k)).map((k) => [k, structuredClone(this.data.get(k))]),
    );
  }

  async set(items: Record<string, unknown>): Promise<void> {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    if (this.offline) throw new Error('offline');
    this.checkRate();
    const next = new Map(this.data);
    for (const [key, value] of Object.entries(items)) {
      if (key.length + JSON.stringify(value).length > SYNC_LIMITS.quotaBytesPerItem) {
        throw new Error('Quota exceeded: QUOTA_BYTES_PER_ITEM');
      }
      next.set(key, structuredClone(value));
    }
    if (next.size > SYNC_LIMITS.maxItems) throw new Error('Quota exceeded: MAX_ITEMS');
    if (this.bytes(next) > SYNC_LIMITS.quotaBytes) throw new Error('Quota exceeded: QUOTA_BYTES');
    this.data = next;
    this.writeTimes.push(this.clock());
    this.writes += 1;
  }

  async remove(keys: string | string[]): Promise<void> {
    if (this.offline) throw new Error('offline');
    this.checkRate();
    for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key);
    this.writeTimes.push(this.clock());
    this.writes += 1;
  }
}
