import { localDateKey } from '../stats';
import type { Box, Card } from './types';

/** Số ngày chờ trước lần ôn kế tiếp của từng hộp. */
export const BOX_INTERVAL_DAYS: Record<Box, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

/** Cộng ngày vào khoá ngày địa phương, đúng cả khi qua tháng, năm và đổi giờ. */
export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
}

export function isBox(value: unknown): value is Box {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * Ôn một thẻ: nhớ thì lên một hộp (tối đa 5), chưa nhớ thì về hộp 1. Lịch ôn
 * kế tiếp tính từ `today` theo khoảng cách của hộp mới.
 */
export function reviewCard(card: Card, remembered: boolean, today: string, now: number): Card {
  const box: Box = remembered ? (Math.min(5, card.box + 1) as Box) : 1;
  return {
    ...card,
    box,
    dueDate: addDays(today, BOX_INTERVAL_DAYS[box]),
    lastReviewedAt: now,
  };
}

/** Thẻ đến hạn (kể cả quá hạn); hộp thấp trước, rồi quá hạn lâu hơn trước. */
export function dueCards(cards: readonly Card[], today: string): Card[] {
  return cards
    .filter((card) => card.dueDate <= today)
    .sort(
      (a, b) => a.box - b.box || a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt,
    );
}

export function boxCounts(cards: readonly Card[]): Record<Box, number> {
  const counts: Record<Box, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of cards) counts[card.box] += 1;
  return counts;
}

/** Chuẩn hoá dữ liệu đọc từ IndexedDB; bản ghi hỏng bị bỏ. */
export function sanitizeCard(value: unknown): Card | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.docId !== 'string') return null;
  if (typeof v.front !== 'string' || typeof v.back !== 'string') return null;
  if (v.front.trim() === '' || v.back.trim() === '') return null;
  if (typeof v.page !== 'number' || !Number.isInteger(v.page) || v.page < 1) return null;
  if (typeof v.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)) return null;
  return {
    id: v.id,
    docId: v.docId,
    front: v.front,
    back: v.back,
    page: v.page,
    source: v.source === 'ai' ? 'ai' : 'summary',
    box: isBox(v.box) ? v.box : 1,
    dueDate: v.dueDate,
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
    ...(typeof v.lastReviewedAt === 'number' ? { lastReviewedAt: v.lastReviewedAt } : {}),
  };
}
