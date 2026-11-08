export type SavedProgress = {
  page: number;
  updatedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Chuẩn hoá tiến độ đọc lấy từ IndexedDB: dữ liệu có thể cũ, hỏng hoặc
 * trỏ tới trang không còn tồn tại. Trả về `null` nếu không dùng được.
 */
export function sanitizeProgress(value: unknown, pageCount: number): SavedProgress | null {
  if (!isRecord(value)) return null;
  if (!Number.isFinite(pageCount) || pageCount < 1) return null;

  const page = value.page;
  if (typeof page !== 'number' || !Number.isFinite(page)) return null;

  const updatedAt = value.updatedAt;
  const lastPage = Math.round(pageCount);

  return {
    page: Math.min(Math.max(Math.round(page), 1), lastPage),
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}
