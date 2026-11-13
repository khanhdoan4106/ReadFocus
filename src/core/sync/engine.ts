import { planWrite, WriteLimiter } from './plan';
import { isSyncKey, sanitizeSyncRecord, syncKey, toSyncValue, type SyncRecord } from './record';

/** Phần của `chrome.storage.StorageArea` mà engine dùng; mock trong test cũng thoả mãn. */
export type SyncArea = {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

export type SyncStatus =
  | { state: 'idle' }
  /** Có thay đổi đang chờ ghi (debounce, hoặc chờ hạn mức lần ghi). */
  | { state: 'pending'; retryAt: number }
  /** Ghi lỗi (quota, mất mạng...): im lặng thử lại sau. */
  | { state: 'retrying'; failures: number; retryAt: number; since: number };

export type FlushResult =
  | { ok: true; written: number; evicted: number }
  | { ok: false; reason: 'nothing' | 'throttled' | 'error'; retryAt: number };

/** Sau chừng này liên tiếp lỗi hoặc chừng này thời gian thì coi là "lỗi kéo dài" và báo trong Cài đặt. */
export const PERSISTENT_FAILURES = 5;
export const PERSISTENT_MS = 15 * 60_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;

export type EngineOptions = {
  now?: () => number;
  limiter?: WriteLimiter;
  maxItems?: number;
  byteBudget?: number;
};

/**
 * Ghi và đọc tiến độ qua `chrome.storage.sync`, tôn trọng giới hạn của Chrome: gộp mọi thay đổi
 * đang chờ thành MỘT lệnh `set` (một lần ghi), thêm một lệnh `remove` khi phải bỏ tài liệu cũ nhất
 * (LRU), kiểm tra hạn mức lần ghi trước khi ghi, lỗi thì giữ lại và thử lại theo backoff.
 * Không bao giờ ném lỗi ra ngoài: việc đọc không bị làm phiền.
 */
export class ProgressSyncEngine {
  private readonly pending = new Map<string, SyncRecord>();
  private failures = 0;
  private failingSince: number | null = null;
  private retryAt = 0;
  private readonly now: () => number;
  private readonly limiter: WriteLimiter;
  private readonly maxItems: number | undefined;
  private readonly byteBudget: number | undefined;

  constructor(
    private readonly area: SyncArea,
    options: EngineOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.limiter = options.limiter ?? new WriteLimiter();
    this.maxItems = options.maxItems;
    this.byteBudget = options.byteBudget;
  }

  /** Xếp hàng một thay đổi; mỗi tài liệu chỉ giữ bản mới nhất. Trả `false` nếu docId không hợp lệ. */
  queue(docId: string, record: SyncRecord): boolean {
    const key = syncKey(docId);
    if (key === null) return false;
    const value = sanitizeSyncRecord(toSyncValue(record));
    if (value === null) return false;
    const current = this.pending.get(key);
    if (!current || value.updatedAt >= current.updatedAt) this.pending.set(key, value);
    return true;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  status(): SyncStatus {
    if (this.failures > 0 && this.failingSince !== null) {
      return {
        state: 'retrying',
        failures: this.failures,
        retryAt: this.retryAt,
        since: this.failingSince,
      };
    }
    if (this.pending.size > 0) return { state: 'pending', retryAt: this.retryAt };
    return { state: 'idle' };
  }

  /** Lỗi kéo dài: giao diện mới hiện trạng thái nhỏ trong Cài đặt. */
  isFailingPersistently(): boolean {
    if (this.failures === 0 || this.failingSince === null) return false;
    return this.failures >= PERSISTENT_FAILURES || this.now() - this.failingSince >= PERSISTENT_MS;
  }

  /** Ghi các thay đổi đang chờ nếu tới lúc và còn hạn mức. */
  async flush(): Promise<FlushResult> {
    const now = this.now();
    if (this.pending.size === 0) return { ok: false, reason: 'nothing', retryAt: now };
    if (now < this.retryAt) return { ok: false, reason: 'throttled', retryAt: this.retryAt };
    // Chừa chỗ cho tối đa hai lần ghi (set + remove).
    if (!this.limiter.canWrite(now, 2)) {
      this.retryAt = this.limiter.nextAllowedAt(now, 2);
      return { ok: false, reason: 'throttled', retryAt: this.retryAt };
    }

    const updates = Object.fromEntries(this.pending);
    try {
      const stored = await this.area.get(null);
      const existing: Record<string, SyncRecord> = {};
      for (const [key, value] of Object.entries(stored)) {
        const record = isSyncKey(key) ? sanitizeSyncRecord(value) : null;
        if (record !== null) existing[key] = record;
      }
      // Bản đồng bộ mới hơn (ghi từ máy khác) không bị bản cũ trên máy này đè lên.
      for (const [key, value] of Object.entries(updates)) {
        const remote = existing[key];
        if (remote && remote.updatedAt > value.updatedAt) delete updates[key];
      }
      const plan = planWrite(existing, updates, this.maxItems, this.byteBudget);
      let writes = 0;
      if (Object.keys(plan.set).length > 0) {
        await this.area.set(plan.set);
        this.limiter.record(this.now());
        writes += 1;
      }
      if (plan.evict.length > 0) {
        await this.area.remove(plan.evict);
        this.limiter.record(this.now());
      }
      this.pending.clear();
      this.failures = 0;
      this.failingSince = null;
      this.retryAt = 0;
      return {
        ok: true,
        written: writes === 0 ? 0 : Object.keys(plan.set).length,
        evicted: plan.evict.length,
      };
    } catch {
      const at = this.now();
      this.failures += 1;
      this.failingSince ??= at;
      this.retryAt = at + Math.min(BACKOFF_BASE_MS * 2 ** (this.failures - 1), BACKOFF_MAX_MS);
      return { ok: false, reason: 'error', retryAt: this.retryAt };
    }
  }

  /** Bản đồng bộ của một tài liệu; không có, hỏng hoặc lỗi đọc thì `null`. */
  async read(docId: string): Promise<SyncRecord | null> {
    const key = syncKey(docId);
    if (key === null) return null;
    try {
      const stored = await this.area.get(key);
      return sanitizeSyncRecord(stored[key]);
    } catch {
      return null;
    }
  }

  /** Xoá CHỈ các khóa `p:*` đã đồng bộ (không đụng khóa khác như `autoOpenPdf`). Trả số khóa đã xoá. */
  async clearSynced(): Promise<number> {
    try {
      const stored = await this.area.get(null);
      const keys = Object.keys(stored).filter(isSyncKey);
      if (keys.length > 0) {
        await this.area.remove(keys);
        this.limiter.record(this.now());
      }
      this.pending.clear();
      this.failures = 0;
      this.failingSince = null;
      return keys.length;
    } catch {
      return 0;
    }
  }
}
