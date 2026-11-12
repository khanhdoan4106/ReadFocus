import { fuseRankings } from './hybrid';
import type { Chunk, EmbeddingRecord } from './types';
import { rankBySimilarity } from './vector';

export type KeywordHit = { page: number; text: string };

export type RetrievedChunk = { chunk: Chunk; score: number };

export type RetrieveInput = {
  chunks: readonly Chunk[];
  records: readonly EmbeddingRecord[];
  /** `null` khi chưa có embedding: chỉ xếp theo từ khoá. */
  queryVector: Float32Array | null;
  /** Kết quả MiniSearch đã xếp giảm dần. */
  keywordHits: readonly KeywordHit[];
  limit: number;
};

/** Đoạn chứa kết quả từ khoá: ưu tiên đoạn chứa nguyên văn, không thì đoạn đầu của trang. */
export function chunkForHit(chunks: readonly Chunk[], hit: KeywordHit): Chunk | null {
  const onPage = chunks.filter((chunk) => chunk.page === hit.page);
  if (onPage.length === 0) return null;
  const probe = hit.text.slice(0, 60);
  return onPage.find((chunk) => probe !== '' && chunk.text.includes(probe)) ?? onPage[0] ?? null;
}

/**
 * Xếp hạng lai: danh sách theo từ khoá (MiniSearch) và danh sách theo cosine
 * được trộn bằng RRF. Thiếu vector thì chỉ còn danh sách từ khoá.
 */
export function hybridRetrieve(input: RetrieveInput): RetrievedChunk[] {
  const byId = new Map(input.chunks.map((chunk) => [chunk.id, chunk]));

  const keywordKeys: string[] = [];
  for (const hit of input.keywordHits) {
    const chunk = chunkForHit(input.chunks, hit);
    if (chunk !== null && !keywordKeys.includes(chunk.id)) keywordKeys.push(chunk.id);
  }

  const semanticKeys: string[] = [];
  if (input.queryVector !== null) {
    const usable = input.records.filter((record) => byId.has(record.chunkId));
    const ranked = rankBySimilarity(
      input.queryVector,
      usable,
      (record) => record.vector,
      Math.max(input.limit * 3, 20),
    );
    for (const { item, score } of ranked) {
      if (score > 0) semanticKeys.push(item.chunkId);
    }
  }

  return fuseRankings([{ keys: keywordKeys }, { keys: semanticKeys }], input.limit).flatMap(
    ({ key, score }) => {
      const chunk = byId.get(key);
      return chunk === undefined ? [] : [{ chunk, score }];
    },
  );
}
