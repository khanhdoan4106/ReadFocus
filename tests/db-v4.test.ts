import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAnnotation } from '../src/core/annotate/record';
import type { Annotation } from '../src/core/annotate/types';
import {
  _resetDbForTest,
  clearAllAnnotations,
  clearAllData,
  countAnnotationsForDoc,
  deleteAnnotation,
  deleteDocumentData,
  loadAnnotations,
  loadProgress,
  loadSetting,
  loadSummary,
  recordDocumentOpen,
  saveAnnotations,
  savePageTexts,
} from '../src/storage/db';

const DB_NAME = 'readfocus';

async function resetDatabase(): Promise<void> {
  _resetDbForTest();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

type Upgrade = Parameters<typeof openDB>[2];

const V1: Upgrade = {
  upgrade(db) {
    db.createObjectStore('documents', { keyPath: 'id' });
    db.createObjectStore('pages', { keyPath: ['docId', 'page'] }).createIndex('by-doc', 'docId');
    db.createObjectStore('toc', { keyPath: 'docId' });
    db.createObjectStore('searchIndex', { keyPath: 'docId' });
    db.createObjectStore('progress', { keyPath: 'docId' });
    db.createObjectStore('stats', { keyPath: 'date' });
    db.createObjectStore('settings', { keyPath: 'key' });
  },
};

const SUMMARY = {
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

const CARD = {
  id: 'card-1',
  docId: 'doc-old',
  front: 'Hỏi?',
  back: 'Đáp.',
  page: 2,
  source: 'summary',
  box: 1,
  dueDate: '2026-01-01',
  createdAt: 5,
};

async function seed(version: 1 | 2 | 3): Promise<void> {
  const db = await openDB(DB_NAME, 1, V1);
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

  if (version >= 2) {
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(upgradeDb) {
        upgradeDb.createObjectStore('summaries', { keyPath: 'id' }).createIndex('by-doc', 'docId');
      },
    });
    await v2.put('summaries', SUMMARY);
    v2.close();
  }
  if (version >= 3) {
    const v3 = await openDB(DB_NAME, 3, {
      upgrade(upgradeDb) {
        for (const name of ['embeddings', 'qa', 'flashcards']) {
          upgradeDb.createObjectStore(name, { keyPath: 'id' }).createIndex('by-doc', 'docId');
        }
      },
    });
    await v3.put('flashcards', CARD);
    v3.close();
  }
}

function note(id: string, docId: string, page = 1, text = ''): Annotation {
  return createAnnotation(
    { docId, page, anchor: { type: 'page' }, note: text },
    { uuid: () => id, now: () => 10 },
  );
}

describe('IndexedDB v4: migration giữ nguyên dữ liệu cũ', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it.each([1, 2, 3] as const)(
    'từ v%i: dữ liệu cũ còn nguyên và có store annotations',
    async (from) => {
      await seed(from);

      expect(await loadSetting('theme')).toBe('dark');
      expect(await loadProgress('doc-old', 10)).toMatchObject({ page: 4 });

      const db = await openDB(DB_NAME);
      expect(db.version).toBe(4);
      expect(db.objectStoreNames.contains('annotations')).toBe(true);
      expect(db.transaction('annotations').store.indexNames.contains('by-doc')).toBe(true);
      expect(await db.get('documents', 'doc-old')).toMatchObject({ name: 'old.pdf' });
      expect(await db.get('pages', ['doc-old', 1])).toEqual({
        docId: 'doc-old',
        page: 1,
        text: 'Trang một',
      });
      if (from >= 2) expect(await loadSummary('sum-1')).toEqual(SUMMARY);
      if (from >= 3) expect(await db.get('flashcards', 'card-1')).toEqual(CARD);
      expect(await db.count('annotations')).toBe(0);
      db.close();
    },
  );

  it('mở lại DB v4 không mất ghi chú đã lưu', async () => {
    await seed(3);
    expect(await saveAnnotations([note('a', 'doc-old', 2, 'giữ lại')])).toBe(true);
    _resetDbForTest();
    expect((await loadAnnotations('doc-old')).map((a) => a.note)).toEqual(['giữ lại']);
  });
});

describe('ghi chú trong IndexedDB', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lưu, đọc theo tài liệu (sắp theo trang), cập nhật cùng id và xoá một mục', async () => {
    await saveAnnotations([note('b', 'doc-1', 5), note('a', 'doc-1', 2), note('c', 'doc-2', 1)]);
    expect((await loadAnnotations('doc-1')).map((a) => a.id)).toEqual(['a', 'b']);
    expect(await countAnnotationsForDoc('doc-1')).toBe(2);

    await saveAnnotations([note('a', 'doc-1', 2, 'đã sửa')]);
    expect((await loadAnnotations('doc-1'))[0]?.note).toBe('đã sửa');
    expect(await countAnnotationsForDoc('doc-1')).toBe(2);

    expect(await deleteAnnotation('a')).toBe(true);
    expect((await loadAnnotations('doc-1')).map((a) => a.id)).toEqual(['b']);
  });

  it('bản ghi hỏng trong DB bị bỏ qua khi đọc nhưng không bị xoá', async () => {
    await saveAnnotations([note('ok', 'doc-1')]);
    const raw = await openDB(DB_NAME);
    await raw.put('annotations', { id: 'hong', docId: 'doc-1', page: 'x' });
    raw.close();
    _resetDbForTest();

    expect((await loadAnnotations('doc-1')).map((a) => a.id)).toEqual(['ok']);
    const check = await openDB(DB_NAME);
    expect(await check.count('annotations')).toBe(2);
    check.close();
  });

  it('xoá dữ liệu một tài liệu xoá ghi chú của tài liệu đó và chỉ của nó', async () => {
    await recordDocumentOpen({ id: 'doc-1', name: 'a.pdf', size: 1, pageCount: 3 });
    await savePageTexts('doc-1', [{ page: 1, text: 'x' }]);
    await saveAnnotations([note('a', 'doc-1'), note('b', 'doc-2')]);

    expect(await deleteDocumentData('doc-1')).toBe(true);
    expect(await loadAnnotations('doc-1')).toEqual([]);
    expect((await loadAnnotations('doc-2')).map((a) => a.id)).toEqual(['b']);
  });

  it('"xoá toàn bộ dữ liệu đọc" KHÔNG xoá ghi chú; clearAllAnnotations mới xoá', async () => {
    await recordDocumentOpen({ id: 'doc-1', name: 'a.pdf', size: 1, pageCount: 3 });
    await saveAnnotations([note('a', 'doc-1'), note('b', 'doc-2')]);

    expect(await clearAllData()).toBe(true);
    expect(await countAnnotationsForDoc('doc-1')).toBe(1);
    expect(await countAnnotationsForDoc('doc-2')).toBe(1);

    expect(await clearAllAnnotations()).toBe(true);
    expect(await countAnnotationsForDoc('doc-1')).toBe(0);
    expect(await countAnnotationsForDoc('doc-2')).toBe(0);
  });
});
