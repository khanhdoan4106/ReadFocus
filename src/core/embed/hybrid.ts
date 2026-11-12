/** Hằng số của Reciprocal Rank Fusion; 60 là giá trị phổ biến trong tài liệu gốc. */
export const RRF_K = 60;

export type RankedList = {
  /** Danh sách đã xếp giảm dần theo độ liên quan; phần tử là khoá của đoạn. */
  keys: readonly string[];
  weight?: number;
};

export type FusedResult = { key: string; score: number };

/**
 * Trộn nhiều danh sách xếp hạng (từ khoá, ý nghĩa) bằng RRF. Chỉ dùng thứ hạng
 * nên không cần quy đổi điểm BM25 và cosine về cùng thang. Đoạn xuất hiện ở cả
 * hai danh sách lên trước; hoà điểm thì giữ thứ tự xuất hiện sớm hơn.
 */
export function fuseRankings(lists: readonly RankedList[], limit: number): FusedResult[] {
  const scores = new Map<string, number>();
  const order = new Map<string, number>();

  for (const list of lists) {
    const weight = list.weight ?? 1;
    list.keys.forEach((key, rank) => {
      scores.set(key, (scores.get(key) ?? 0) + weight / (RRF_K + rank + 1));
      if (!order.has(key)) order.set(key, order.size);
    });
  }

  return [...scores.entries()]
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0))
    .slice(0, Math.max(0, limit));
}
