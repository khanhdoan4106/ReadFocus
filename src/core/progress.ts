export type SavedProgress = {
  page: number;
  updatedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Chọn trang để cập nhật từ báo cáo của danh sách trang.
 *
 * Khi mở lại tài liệu, danh sách trang báo trang 1 (vị trí cuộn lúc đó) trước khi
 * lệnh nhảy tới trang khôi phục chạy xong. Nhận báo cáo đó sẽ ghi đè trang vừa khôi
 * phục, nên trong lúc chờ khôi phục chỉ chấp nhận đúng trang đích. Trả về `null`
 * nghĩa là bỏ qua báo cáo.
 */
export function acceptPageReport(reported: number, restoringTo: number | null): number | null {
  if (restoringTo === null) return reported;
  return reported === restoringTo ? reported : null;
}

/** Chưa nhảy xong tới trang khôi phục thì không được ghi tiến độ. */
export function canPersistProgress(restoringTo: number | null): boolean {
  return restoringTo === null;
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
