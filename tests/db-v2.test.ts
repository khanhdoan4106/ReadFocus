import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetDbForTest,
  clearAllData,
  deleteDocumentData,
  loadSummariesForDoc,
  loadSummary,
  saveSummary,
} from '../src/storage/db';
import type { SummaryRecord } from '../src/core/summarize/record';

const sampleRecord1: SummaryRecord = {
  id: 'cache-key-1',
  docId: 'doc-123',
  startPage: 1,
  endPage: 5,
  title: 'Chương 1',
  providerId: 'openai',
  model: 'gpt-4o-mini',
  promptVersion: 1,
  language: 'vi',
  summary: 'Tóm tắt chương 1.',
  keyPoints: [{ text: 'Ý chính 1', pages: [1, 2] }],
  terms: [{ term: 'Khái niệm', definition: 'Định nghĩa' }],
  createdAt: 1700000000000,
};

const sampleRecord2: SummaryRecord = {
  id: 'cache-key-2',
  docId: 'doc-456',
  startPage: 1,
  endPage: 3,
  title: 'Mục 1',
  providerId: 'gemini',
  model: 'gemini-1.5-flash',
  promptVersion: 1,
  language: 'vi',
  summary: 'Tóm tắt doc 2.',
  keyPoints: [],
  terms: [],
  createdAt: 1700000001000,
};

describe('IndexedDB v2 & summaries store', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('nâng cấp từ v1 sang v2 vẫn giữ nguyên dữ liệu v1 và tạo store summaries', async () => {
    _resetDbForTest();
    indexedDB.deleteDatabase('readfocus');

    // 1. Giả lập DB v1 cũ có dữ liệu documents và pages
    const v1Db = await openDB('readfocus', 1, {
      upgrade(db) {
        db.createObjectStore('documents', { keyPath: 'id' });
        const pages = db.createObjectStore('pages', { keyPath: ['docId', 'page'] });
        pages.createIndex('by-doc', 'docId');
        db.createObjectStore('toc', { keyPath: 'docId' });
        db.createObjectStore('searchIndex', { keyPath: 'docId' });
        db.createObjectStore('progress', { keyPath: 'docId' });
        db.createObjectStore('stats', { keyPath: 'date' });
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });

    await v1Db.put('documents', {
      id: 'doc-old',
      name: 'old.pdf',
      size: 100,
      pageCount: 10,
      addedAt: 1000,
      lastOpenedAt: 2000,
    });
    await v1Db.put('progress', {
      docId: 'doc-old',
      page: 4,
      updatedAt: 1500,
    });
    await v1Db.put('settings', {
      key: 'readingSpeed',
      value: { wordsPerMinute: 250, sampleWords: 250, sampleSeconds: 60 },
    });
    v1Db.close();

    // 2. Gọi API `saveSummary` (sẽ trigger openDB với DB_VERSION = 2)
    await saveSummary(sampleRecord1);

    // 3. Đảm bảo dữ liệu v1 cũ vẫn còn
    const v2Db = await openDB('readfocus', 2);
    const oldDoc = await v2Db.get('documents', 'doc-old');
    expect(oldDoc).toEqual({
      id: 'doc-old',
      name: 'old.pdf',
      size: 100,
      pageCount: 10,
      addedAt: 1000,
      lastOpenedAt: 2000,
    });
    const oldProgress = await v2Db.get('progress', 'doc-old');
    expect(oldProgress).toEqual({
      docId: 'doc-old',
      page: 4,
      updatedAt: 1500,
    });
    const oldSetting = await v2Db.get('settings', 'readingSpeed');
    expect(oldSetting).toEqual({
      key: 'readingSpeed',
      value: { wordsPerMinute: 250, sampleWords: 250, sampleSeconds: 60 },
    });

    // Store summaries tồn tại và chứa dữ liệu vừa save
    const loaded = await loadSummary('cache-key-1');
    expect(loaded).toEqual(sampleRecord1);
    v2Db.close();
  });

  it('lưu và truy vấn tóm tắt theo docId', async () => {
    await saveSummary(sampleRecord1);
    await saveSummary(sampleRecord2);

    const doc1Summaries = await loadSummariesForDoc('doc-123');
    expect(doc1Summaries).toEqual([sampleRecord1]);

    const doc2Summaries = await loadSummariesForDoc('doc-456');
    expect(doc2Summaries).toEqual([sampleRecord2]);
  });

  it('deleteDocumentData xoá cả tóm tắt của tài liệu đó', async () => {
    await saveSummary(sampleRecord1);
    await saveSummary(sampleRecord2);

    const ok = await deleteDocumentData('doc-123');
    expect(ok).toBe(true);

    expect(await loadSummary('cache-key-1')).toBeNull();
    expect(await loadSummariesForDoc('doc-123')).toEqual([]);
    // Tài liệu khác không bị ảnh hưởng
    expect(await loadSummary('cache-key-2')).toEqual(sampleRecord2);
  });

  it('clearAllData xoá toàn bộ tóm tắt', async () => {
    await saveSummary(sampleRecord1);
    await saveSummary(sampleRecord2);

    const ok = await clearAllData();
    expect(ok).toBe(true);

    expect(await loadSummariesForDoc('doc-123')).toEqual([]);
    expect(await loadSummariesForDoc('doc-456')).toEqual([]);
  });
});
