/** Chuẩn hoá L2 để cosine thành tích vô hướng. Vector không (toàn 0) giữ nguyên. */
export function normalizeVector(values: ArrayLike<number>): Float32Array {
  const result = new Float32Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]);
    result[i] = Number.isFinite(value) ? value : 0;
    sum += (result[i] ?? 0) ** 2;
  }
  const norm = Math.sqrt(sum);
  if (norm === 0) return result;
  for (let i = 0; i < result.length; i += 1) result[i] = (result[i] ?? 0) / norm;
  return result;
}

/** Cosine của hai vector; khác chiều hoặc có vector không thì trả 0. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type Scored<T> = { item: T; score: number };

/** Brute-force: xếp mục theo cosine với truy vấn, giảm dần, lấy `limit` mục đầu. */
export function rankBySimilarity<T>(
  query: ArrayLike<number>,
  items: readonly T[],
  vectorOf: (item: T) => ArrayLike<number>,
  limit: number,
): Scored<T>[] {
  return items
    .map((item) => ({ item, score: cosine(query, vectorOf(item)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}
