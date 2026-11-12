import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetDbForTest,
  clearPageTexts,
  clearAllData,
  deleteDocumentData,
  loadOcrPages,
  loadSetting,
  loadSummary,
  savePageTexts,
  saveSummary,
} from '../src/storage/db';
import type { SummaryRecord } from '../src/core/summarize/record';

const DB_NAME = 'readfocus';

const summary: SummaryRecord = {
  id: 'sum-1',
  docId: 'doc-old',
  startPage: 1,
  endPage: 5,
  title: 'Chương 1',
  providerId: 'openai',
  model: 'm',
  promptVersion: 1,
  language: 'vi',
  summary: 'Tóm tắt.',
  keyPoints: [],
  terms: [],
  createdAt: 1,
};

async function resetDatabase(): Promise<void> {
  _resetDbForTest();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

/** Tạo schema v1 đúng như bản v0 đã phát hành, kèm dữ liệu mẫu. */
async function seedV1(): Promise<void> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(upgradeDb) {
      upgradeDb.createObjectStore('documents', { keyPath: 'id' });
      const pages = upgradeDb.createObjectStore('pages', { keyPath: ['docId', 'page'] });
      pages.createIndex('by-doc', 'docId');
      upgradeDb.createObjectStore('toc', { keyPath: 'docId' });
      upgradeDb.createObjectStore('searchIndex', { keyPath: 'docId' });
      upgradeDb.createObjectStore('progress', { keyPath: 'docId' });
      upgradeDb.createObjectStore('stats', { keyPath: 'date' });
      upgradeDb.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  await db.put('documents', {
    id: 'doc-old',
    name: 'old.pdf',
    size: 100,
    pageCount: 10,
    addedAt: 1,
    lastOpenedAt: 2,
  });
  await db.put('pages', { docId: 'doc-old', page: 1, text: 'Trang một' });
  await db.put('progress', { docId: 'doc-old', page: 4, updatedAt: 3 });
  await db.put('settings', { key: 'theme', value: 'dark' });
  db.close();
}

describe('IndexedDB v3', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('nâng cấp từ v1 giữ nguyên dữ liệu cũ và tạo các store mới', async () => {
    await seedV1();

    // Mở bằng API của ứng dụng để chạy migration lên v3.
    expect(await loadSetting('theme')).toBe('dark');

    const db = await openDB(DB_NAME);
    expect(db.version).toBe(3);
    expect(await db.get('progress', 'doc-old')).toEqual({
      docId: 'doc-old',
      page: 4,
      updatedAt: 3,
    });
    expect([...db.objectStoreNames].sort()).toEqual(
      [
        'documents',
        'embeddings',
        'flashcards',
        'pages',
        'progress',
        'qa',
        'searchIndex',
        'settings',
        'stats',
        'summaries',
        'toc',
      ].sort(),
    );
    expect(await db.get('pages', ['doc-old', 1])).toEqual({
      docId: 'doc-old',
      page: 1,
      text: 'Trang một',
    });
    for (const name of ['embeddings', 'qa', 'flashcards', 'summaries'] as const) {
      expect(db.transaction(name).store.indexNames.contains('by-doc'), name).toBe(true);
    }
    db.close();
  });

  it('nâng cấp từ v2 giữ nguyên tóm tắt, tiến độ và cài đặt', async () => {
    await seedV1();
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(upgradeDb) {
        upgradeDb.createObjectStore('summaries', { keyPath: 'id' }).createIndex('by-doc', 'docId');
      },
    });
    await v2.put('summaries', summary);
    v2.close();

    expect(await loadSummary('sum-1')).toEqual(summary);
    expect(await loadSetting('theme')).toBe('dark');

    const db = await openDB(DB_NAME);
    expect(db.version).toBe(3);
    expect(await db.get('progress', 'doc-old')).toMatchObject({ page: 4 });
    expect(db.objectStoreNames.contains('embeddings')).toBe(true);
    db.close();
  });

  it('lưu và đọc lại trang OCR cùng hộp bao từ, trang thường không có trường source', async () => {
    await savePageTexts('doc-1', [
      { page: 1, text: 'Có lớp chữ' },
      {
        page: 2,
        text: 'Chữ nhận dạng',
        source: 'ocr',
        confidence: 83.5,
        ocr: {
          width: 1200,
          height: 1600,
          words: [{ text: 'Chữ', confidence: 90, box: { x0: 1, y0: 2, x1: 30, y1: 20 } }],
        },
      },
    ]);

    const ocr = await loadOcrPages('doc-1');
    expect(ocr).toHaveLength(1);
    expect(ocr[0]).toMatchObject({
      docId: 'doc-1',
      page: 2,
      source: 'ocr',
      confidence: 83.5,
      ocr: { width: 1200, height: 1600 },
    });

    const db = await openDB(DB_NAME);
    expect(await db.get('pages', ['doc-1', 1])).toEqual({
      docId: 'doc-1',
      page: 1,
      text: 'Có lớp chữ',
    });
    db.close();
  });

  it('clearPageTexts giữ trang OCR và chỉ xoá trang trích từ lớp chữ PDF', async () => {
    await savePageTexts('doc-1', [
      { page: 1, text: 'có lớp chữ' },
      { page: 2, text: 'chữ OCR', source: 'ocr', confidence: 80 },
    ]);

    await clearPageTexts('doc-1');
    expect((await loadOcrPages('doc-1')).map((page) => page.page)).toEqual([2]);

    const db = await openDB(DB_NAME);
    expect(await db.getAllFromIndex('pages', 'by-doc', 'doc-1')).toHaveLength(1);
    db.close();

    await clearPageTexts('doc-1', false);
    expect(await loadOcrPages('doc-1')).toEqual([]);
  });

  async function seedV3Records(): Promise<void> {
    await saveSummary({ ...summary, docId: 'doc-a', id: 'sum-a' });
    await saveSummary({ ...summary, docId: 'doc-b', id: 'sum-b' });
    await savePageTexts('doc-a', [{ page: 1, text: 'a', source: 'ocr', confidence: 70 }]);
    const db = await openDB(DB_NAME);
    for (const name of ['embeddings', 'qa', 'flashcards'] as const) {
      await db.put(name, { id: `${name}-a`, docId: 'doc-a' });
      await db.put(name, { id: `${name}-b`, docId: 'doc-b' });
    }
    db.close();
  }

  it('deleteDocumentData xoá cả embeddings, qa, flashcards và trang OCR của tài liệu đó', async () => {
    await seedV3Records();

    expect(await deleteDocumentData('doc-a')).toBe(true);

    const db = await openDB(DB_NAME);
    for (const name of ['embeddings', 'qa', 'flashcards', 'summaries'] as const) {
      expect(await db.getAllFromIndex(name, 'by-doc', 'doc-a'), name).toEqual([]);
      expect(await db.getAllFromIndex(name, 'by-doc', 'doc-b'), name).toHaveLength(1);
    }
    expect(await db.getAllFromIndex('pages', 'by-doc', 'doc-a')).toEqual([]);
    db.close();
  });

  it('clearAllData xoá sạch các store mới', async () => {
    await seedV3Records();

    expect(await clearAllData()).toBe(true);

    const db = await openDB(DB_NAME);
    for (const name of ['embeddings', 'qa', 'flashcards', 'summaries', 'pages'] as const) {
      expect(await db.count(name), name).toBe(0);
    }
    db.close();
  });
});
