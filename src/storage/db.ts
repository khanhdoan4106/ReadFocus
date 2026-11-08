import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { sanitizeProgress, type SavedProgress } from '../core/progress';

const DB_NAME = 'readfocus';
const DB_VERSION = 1;

export type DocumentMeta = {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  addedAt: number;
  lastOpenedAt: number;
};

export type PageText = {
  docId: string;
  page: number;
  text: string;
};

export type TocItem = {
  title: string;
  startPage: number;
  endPage: number;
  level: number;
  wordCount: number;
};

export type TocRecord = {
  docId: string;
  items: TocItem[];
};

export type SearchIndexRecord = {
  docId: string;
  data: unknown;
};

export type ReadingProgress = {
  docId: string;
  page: number;
  updatedAt: number;
};

export type DailyStats = {
  date: string;
  minutes: number;
  pages: number;
};

export type SettingRecord = {
  key: string;
  value: unknown;
};

interface ReadFocusDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentMeta;
  };
  pages: {
    key: [string, number];
    value: PageText;
    indexes: { 'by-doc': string };
  };
  toc: {
    key: string;
    value: TocRecord;
  };
  searchIndex: {
    key: string;
    value: SearchIndexRecord;
  };
  progress: {
    key: string;
    value: ReadingProgress;
  };
  stats: {
    key: string;
    value: DailyStats;
  };
  settings: {
    key: string;
    value: SettingRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<ReadFocusDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ReadFocusDB>> {
  dbPromise ??= openDB<ReadFocusDB>(DB_NAME, DB_VERSION, {
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
  return dbPromise;
}

/** Ghi metadata tài liệu, giữ nguyên `addedAt` nếu đã từng mở trước đó. */
export async function recordDocumentOpen(
  meta: Omit<DocumentMeta, 'addedAt' | 'lastOpenedAt'>,
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('documents', 'readwrite');
    const existing = await tx.store.get(meta.id);
    const now = Date.now();
    await tx.store.put({
      ...meta,
      addedAt: existing?.addedAt ?? now,
      lastOpenedAt: now,
    });
    await tx.done;
  } catch {
    // Metadata chỉ để hiển thị về sau; lỗi lưu trữ không được chặn việc đọc.
  }
}

export async function saveProgress(
  docId: string,
  page: number,
  updatedAt = Date.now(),
): Promise<void> {
  try {
    const db = await getDb();
    await db.put('progress', { docId, page, updatedAt });
  } catch {
    // Không lưu được tiến độ thì vẫn cho người dùng đọc tiếp.
  }
}

export async function loadProgress(
  docId: string,
  pageCount: number,
): Promise<SavedProgress | null> {
  try {
    const db = await getDb();
    return sanitizeProgress(await db.get('progress', docId), pageCount);
  } catch {
    return null;
  }
}

/** Xoá văn bản đã trích của một tài liệu trước khi lập chỉ mục lại. */
export async function clearPageTexts(docId: string): Promise<void> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('pages', 'by-doc', docId);
    const tx = db.transaction('pages', 'readwrite');
    for (const key of keys) void tx.store.delete(key);
    await tx.done;
  } catch {
    // Lập chỉ mục lại vẫn ghi đè được các trang cũ; lỗi xoá không chặn việc đọc.
  }
}

export async function savePageTexts(
  docId: string,
  pages: readonly { page: number; text: string }[],
): Promise<void> {
  if (pages.length === 0) return;

  try {
    const db = await getDb();
    const tx = db.transaction('pages', 'readwrite');
    for (const page of pages) {
      void tx.store.put({ docId, page: page.page, text: page.text });
    }
    await tx.done;
  } catch {
    // Không lưu được văn bản thì vẫn cho người dùng đọc tiếp.
  }
}
