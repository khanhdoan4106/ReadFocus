/** Hộp Leitner từ 1 (ôn thường xuyên nhất) đến 5. */
export type Box = 1 | 2 | 3 | 4 | 5;

/** `note`: tạo từ highlight/ghi chú của người dùng (không gọi API). */
export type CardSource = 'summary' | 'ai' | 'note';

export type Card = {
  id: string;
  docId: string;
  front: string;
  back: string;
  /** Trang nguồn; luôn nằm trong tài liệu. */
  page: number;
  source: CardSource;
  box: Box;
  /** Ngày địa phương `YYYY-MM-DD`; thẻ đến hạn khi `dueDate <= hôm nay`. */
  dueDate: string;
  createdAt: number;
  lastReviewedAt?: number;
};

export type CardDraft = Pick<Card, 'front' | 'back' | 'page' | 'source'>;
