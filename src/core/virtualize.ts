export type PageOffset = {
  page: number;
  top: number;
  height: number;
};

export type VisiblePages = {
  active: number[];
  current: number;
};

/**
 * Tính những trang cần render và trang đang đọc, dựa trên vị trí cuộn.
 * `marginFactor` là số màn hình render thêm ở mỗi phía để cuộn mượt.
 */
export function computeVisiblePages(
  pages: readonly PageOffset[],
  scrollTop: number,
  viewportHeight: number,
  marginFactor = 1,
): VisiblePages {
  if (pages.length === 0) return { active: [], current: 1 };

  const margin = viewportHeight * marginFactor;
  const viewportBottom = scrollTop + viewportHeight;
  const probe = scrollTop + viewportHeight * 0.3;

  const active: number[] = [];
  let current = pages[0]?.page ?? 1;

  for (const item of pages) {
    const bottom = item.top + item.height;
    if (bottom >= scrollTop - margin && item.top <= viewportBottom + margin) {
      active.push(item.page);
    }
    if (item.top <= probe) current = item.page;
  }

  return { active, current };
}
