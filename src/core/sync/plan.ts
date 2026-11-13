import { isSyncKey, type SyncRecord } from './record';

/**
 * Giới hạn của `chrome.storage.sync` (https://developer.chrome.com/docs/extensions/reference/api/storage,
 * tra 13/11/2026): tổng 102.400 byte, 8.192 byte mỗi mục, 512 mục; tối đa 120 lần ghi mỗi phút và
 * 1.800 lần mỗi giờ (set, remove và clear đều tính là ghi). Dung lượng tính bằng JSON của giá trị
 * cộng độ dài khóa. Thiết kế dưới các giới hạn đó, chừa chỗ cho khóa khác (ví dụ `autoOpenPdf`).
 */
export const SYNC_LIMITS = {
  quotaBytes: 102_400,
  quotaBytesPerItem: 8_192,
  maxItems: 512,
  maxWritesPerMinute: 120,
  maxWritesPerHour: 1_800,
} as const;

/** Số mục tiến độ tối đa giữ trong sync (còn dư ~100 mục cho khóa khác). */
export const MAX_PROGRESS_ITEMS = 400;
/** Ngân sách byte cho các mục tiến độ (khoảng 80% tổng). */
export const PROGRESS_BYTE_BUDGET = 80_000;

/** Dung lượng một mục theo cách Chrome tính: JSON của giá trị cộng độ dài khóa. */
export function itemBytes(key: string, value: unknown): number {
  return key.length + JSON.stringify(value).length;
}

export type WritePlan = {
  /** Các mục cần ghi (một lệnh `set` = một lần ghi). */
  set: Record<string, SyncRecord>;
  /** Các khóa tiến độ cũ nhất bị bỏ để nhường chỗ (một lệnh `remove` = một lần ghi). */
  evict: string[];
};

/**
 * Lập kế hoạch ghi: gộp `updates` vào các mục tiến độ đang có, rồi bỏ các tài liệu CŨ NHẤT
 * (theo `updatedAt`, LRU) cho tới khi dưới giới hạn số mục và ngân sách byte. Mục vừa được ghi
 * không bao giờ bị bỏ (trừ khi một mình nó vượt ngưỡng mỗi mục, tức không thể xảy ra với 3 số).
 */
export function planWrite(
  existing: Readonly<Record<string, SyncRecord>>,
  updates: Readonly<Record<string, SyncRecord>>,
  maxItems: number = MAX_PROGRESS_ITEMS,
  byteBudget: number = PROGRESS_BYTE_BUDGET,
): WritePlan {
  const all = new Map<string, SyncRecord>();
  for (const [key, value] of Object.entries(existing)) {
    if (isSyncKey(key)) all.set(key, value);
  }
  const written = new Set<string>();
  for (const [key, value] of Object.entries(updates)) {
    all.set(key, value);
    written.add(key);
  }

  const bytes = () => [...all].reduce((sum, [key, value]) => sum + itemBytes(key, value), 0);
  const oldestFirst = [...all.entries()]
    .filter(([key]) => !written.has(key))
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt || a[0].localeCompare(b[0]));

  const evict: string[] = [];
  let total = bytes();
  for (const [key, value] of oldestFirst) {
    if (all.size <= maxItems && total <= byteBudget) break;
    all.delete(key);
    total -= itemBytes(key, value);
    evict.push(key);
  }
  return { set: { ...updates }, evict };
}

/** Giới hạn số lần ghi: chừa dư so với 120/phút và 1.800/giờ của Chrome. */
export class WriteLimiter {
  private readonly times: number[] = [];

  constructor(
    private readonly perMinute: number = 100,
    private readonly perHour: number = 1_500,
  ) {}

  private prune(now: number): void {
    const cutoff = now - 3_600_000;
    while (this.times.length > 0 && (this.times[0] as number) <= cutoff) this.times.shift();
  }

  /** Còn đủ chỗ cho `count` lần ghi ngay bây giờ không. */
  canWrite(now: number, count = 1): boolean {
    this.prune(now);
    const inMinute = this.times.filter((t) => t > now - 60_000).length;
    return inMinute + count <= this.perMinute && this.times.length + count <= this.perHour;
  }

  record(now: number, count = 1): void {
    for (let i = 0; i < count; i += 1) this.times.push(now);
  }

  /** Thời điểm sớm nhất có thể ghi `count` lần (bằng `now` nếu ghi được ngay). */
  nextAllowedAt(now: number, count = 1): number {
    this.prune(now);
    if (this.canWrite(now, count)) return now;
    const candidates = this.times
      .flatMap((t) => [t + 60_000 + 1, t + 3_600_000 + 1])
      .filter((t) => t > now)
      .sort((x, y) => x - y);
    for (const at of candidates) {
      if (this.canWrite(at, count)) return at;
    }
    return now + 3_600_000;
  }
}
