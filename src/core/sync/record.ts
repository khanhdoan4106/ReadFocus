/**
 * Đồng bộ tiến độ đọc qua `chrome.storage.sync` (nhóm N). Dữ liệu đồng bộ CHỈ gồm khóa
 * `p:<32 ký tự đầu của SHA-256 tài liệu>` và giá trị `{ page, pageCount, updatedAt }`.
 * Không bao giờ có tên file, văn bản, ghi chú hay key AI.
 */
export const SYNC_PREFIX = 'p:';
export const SYNC_KEY_HASH_LENGTH = 32;

export type SyncRecord = {
  page: number;
  pageCount: number;
  updatedAt: number;
};

/** Đúng các trường được phép có trong giá trị đồng bộ. */
export const SYNC_VALUE_FIELDS = ['page', 'pageCount', 'updatedAt'] as const;

/** Khóa đồng bộ của một tài liệu (docId là SHA-256 dạng hex). */
export function syncKey(docId: string): string | null {
  const hash = docId.trim().toLowerCase();
  if (!/^[0-9a-f]{32,}$/.test(hash)) return null;
  return `${SYNC_PREFIX}${hash.slice(0, SYNC_KEY_HASH_LENGTH)}`;
}

export function isSyncKey(key: string): boolean {
  return new RegExp(`^${SYNC_PREFIX}[0-9a-f]{${SYNC_KEY_HASH_LENGTH}}$`).test(key);
}

/** Tạo giá trị đồng bộ: luôn đúng ba trường, kể cả khi đầu vào có thêm trường khác. */
export function toSyncValue(source: SyncRecord): SyncRecord {
  return { page: source.page, pageCount: source.pageCount, updatedAt: source.updatedAt };
}

/** Đọc giá trị lấy từ sync (có thể hỏng hoặc do bản khác ghi): sai kiểu thì `null`, trường lạ bị bỏ. */
export function sanitizeSyncRecord(raw: unknown): SyncRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { page, pageCount, updatedAt } = raw as Record<string, unknown>;
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) return null;
  if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 1) return null;
  if (page > pageCount) return null;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) return null;
  return { page, pageCount, updatedAt };
}

/** Sai số đồng hồ chấp nhận được giữa các máy; mốc xa hơn trong tương lai bị kẹp về `now + dung sai`. */
export const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

export type Winner = 'local' | 'remote' | 'same';

/**
 * Last-writer-wins: bản có `updatedAt` mới hơn thắng. Đồng hồ lệch: mốc thời gian vượt quá
 * `now + CLOCK_SKEW_MS` bị kẹp (một máy chạy nhanh quá không thể thắng mãi). Hai mốc bằng nhau
 * (sau khi kẹp) thì bản trên máy này giữ nguyên (`same`); dữ liệu hỏng thì bỏ qua.
 */
export function chooseWinner(local: unknown, remote: unknown, now: number): Winner {
  const mine = sanitizeSyncRecord(local);
  const theirs = sanitizeSyncRecord(remote);
  if (theirs === null) return 'local';
  if (mine === null) return 'remote';
  const limit = now + CLOCK_SKEW_MS;
  const a = Math.min(mine.updatedAt, limit);
  const b = Math.min(theirs.updatedAt, limit);
  if (b > a) return 'remote';
  if (b < a) return 'local';
  return 'same';
}

/**
 * Bản đồng bộ có đáng báo "Trên máy khác bạn đã đọc tới trang X" không: bản đồng bộ phải thắng
 * theo LWW VÀ trỏ tới trang khác trang hiện có trên máy.
 */
export function remoteReadingAhead(
  local: { page: number; updatedAt: number } | null,
  remote: unknown,
  now: number,
): SyncRecord | null {
  const theirs = sanitizeSyncRecord(remote);
  if (theirs === null) return null;
  if (local === null) return theirs;
  const mine: SyncRecord = {
    page: local.page,
    pageCount: theirs.pageCount,
    updatedAt: local.updatedAt,
  };
  if (chooseWinner(mine, theirs, now) !== 'remote') return null;
  return theirs.page === local.page ? null : theirs;
}
