export type DayStats = {
  /** Ngày địa phương dạng YYYY-MM-DD. */
  date: string;
  minutes: number;
  pages: number;
};

/** Khoá ngày theo múi giờ máy, không dùng ISO UTC để tránh lệch sang ngày khác. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function emptyDayStats(date = localDateKey()): DayStats {
  return { date, minutes: 0, pages: 0 };
}

function nonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function addReading(stats: DayStats, minutes: number, pages: number): DayStats {
  return {
    date: stats.date,
    minutes: stats.minutes + nonNegative(minutes),
    pages: stats.pages + Math.round(nonNegative(pages)),
  };
}

/** Kiểm tra dữ liệu thống kê đọc từ IndexedDB. */
export function sanitizeDayStats(value: unknown): DayStats | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return null;

  return {
    date: record.date,
    minutes: nonNegative(record.minutes),
    pages: Math.round(nonNegative(record.pages)),
  };
}

export function totalReading(days: readonly DayStats[]): { minutes: number; pages: number } {
  return days.reduce(
    (total, day) => ({
      minutes: total.minutes + day.minutes,
      pages: total.pages + day.pages,
    }),
    { minutes: 0, pages: 0 },
  );
}
