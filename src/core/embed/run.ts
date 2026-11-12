import { LLMError } from '../llm/errors';
import { textHash } from './chunk';
import type { Chunk, EmbedProgress, EmbeddingRecord } from './types';

export type EmbedFn = (texts: readonly string[], signal: AbortSignal) => Promise<Float32Array[]>;

export type EmbedRunOptions = {
  docId: string;
  key: string;
  chunks: readonly Chunk[];
  /** Vector đã có (cùng khoá nguồn); chỉ dùng khi `textHash` còn khớp. */
  existing: readonly EmbeddingRecord[];
  embed: EmbedFn;
  signal: AbortSignal;
  batchSize: number;
  now?: () => number;
  /** Gọi sau mỗi lô thành công để lưu từng phần. */
  onBatch?: (records: EmbeddingRecord[]) => Promise<void> | void;
  onProgress?: (progress: EmbedProgress) => void;
};

export function embeddingId(docId: string, key: string, chunkId: string): string {
  return `${docId}\u0000${key}\u0000${chunkId}`;
}

/** Các đoạn chưa có vector hợp lệ: thiếu bản ghi, hoặc nội dung đã đổi. */
export function chunksToEmbed(
  chunks: readonly Chunk[],
  existing: readonly EmbeddingRecord[],
): Chunk[] {
  const byChunk = new Map(existing.map((record) => [record.chunkId, record]));
  return chunks.filter((chunk) => byChunk.get(chunk.id)?.textHash !== textHash(chunk.text));
}

/**
 * Embedding tuần tự theo lô. Huỷ hoặc lỗi thì dừng ngay, không gửi lô sau; các
 * lô đã xong đã được lưu qua `onBatch`. Vector lô nào về sau khi đã huỷ thì bỏ.
 */
export async function runEmbedding(options: EmbedRunOptions): Promise<EmbedProgress> {
  const { docId, key, signal, batchSize } = options;
  const pending = chunksToEmbed(options.chunks, options.existing);
  const total = pending.length;
  let done = 0;
  options.onProgress?.({ done, total });

  for (let start = 0; start < pending.length; start += batchSize) {
    if (signal.aborted) throw new LLMError('cancelled', 'Aborted');

    const batch = pending.slice(start, start + batchSize);
    const vectors = await options.embed(
      batch.map((chunk) => chunk.text),
      signal,
    );
    if (signal.aborted) throw new LLMError('cancelled', 'Aborted');
    if (vectors.length !== batch.length) {
      throw new LLMError('bad-response', 'Embedding count does not match the request');
    }

    const createdAt = (options.now ?? Date.now)();
    const records = batch.map((chunk, i): EmbeddingRecord => ({
      id: embeddingId(docId, key, chunk.id),
      docId,
      key,
      page: chunk.page,
      chunkId: chunk.id,
      textHash: textHash(chunk.text),
      vector: vectors[i] as Float32Array,
      createdAt,
    }));
    await options.onBatch?.(records);
    done += batch.length;
    options.onProgress?.({ done, total });
  }

  return { done, total };
}

/** Ước lượng trước khi chạy: số đoạn cần embedding và số request. */
export function estimateEmbedWork(pendingChunks: number, batchSize: number) {
  return { chunks: pendingChunks, requests: Math.ceil(pendingChunks / batchSize) };
}
