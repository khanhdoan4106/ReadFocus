import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EmbeddingRecord } from '../src/core/embed/types';
import {
  _resetDbForTest,
  deleteDocumentData,
  deleteEmbeddingsForDoc,
  loadEmbeddings,
  saveEmbeddings,
} from '../src/storage/db';

function record(docId: string, key: string, chunkId: string): EmbeddingRecord {
  return {
    id: `${docId}|${key}|${chunkId}`,
    docId,
    key,
    page: 1,
    chunkId,
    textHash: 'h',
    vector: new Float32Array([0.5, 0.25]),
    createdAt: 1,
  };
}

beforeEach(async () => {
  _resetDbForTest();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('readfocus');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  _resetDbForTest();
});

describe('embedding storage', () => {
  it('lưu Float32Array và đọc lại đúng giá trị', async () => {
    await saveEmbeddings([record('d1', 'openai|m', '1:0')]);
    const [loaded] = await loadEmbeddings('d1', 'openai|m');
    expect(loaded?.vector).toBeInstanceOf(Float32Array);
    expect(Array.from(loaded!.vector)).toEqual([0.5, 0.25]);
  });

  it('không trả vector của nguồn khác hay tài liệu khác', async () => {
    await saveEmbeddings([
      record('d1', 'openai|m', '1:0'),
      record('d1', 'gemini|m', '1:0'),
      record('d2', 'openai|m', '1:0'),
    ]);
    const loaded = await loadEmbeddings('d1', 'openai|m');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.key).toBe('openai|m');
  });

  it('deleteEmbeddingsForDoc xoá mọi nguồn của một tài liệu', async () => {
    await saveEmbeddings([
      record('d1', 'a', '1:0'),
      record('d1', 'b', '1:0'),
      record('d2', 'a', '1:0'),
    ]);
    await deleteEmbeddingsForDoc('d1');
    expect(await loadEmbeddings('d1', 'a')).toEqual([]);
    expect(await loadEmbeddings('d2', 'a')).toHaveLength(1);
  });

  it('xoá dữ liệu tài liệu xoá cả vector', async () => {
    await saveEmbeddings([record('d1', 'a', '1:0')]);
    await deleteDocumentData('d1');
    expect(await loadEmbeddings('d1', 'a')).toEqual([]);
  });
});
