import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { sanitizeProgress, type SavedProgress } from '../core/progress';
import {
  addReading,
  emptyDayStats,
  localDateKey,
  sanitizeDayStats,
  type DayStats,
} from '../core/stats';

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

export type DailyStats = DayStats;

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

/** Thống kê của một ngày; chưa có dữ liệu thì trả về ngày rỗng. */
export async function loadDayStats(date = localDateKey()): Promise<DayStats> {
  try {
    const db = await getDb();
    return sanitizeDayStats(await db.get('stats', date)) ?? emptyDayStats(date);
  } catch {
    return emptyDayStats(date);
  }
}

/**
 * Cộng thêm phút và số trang đã đọc vào thống kê ngày. Lỗi lưu trữ không được
 * chặn việc đọc nên hàm luôn trả về số liệu vừa cộng.
 */
export async function addDailyReading(
  minutes: number,
  pages: number,
  date = localDateKey(),
): Promise<DayStats> {
  const current = await loadDayStats(date);
  const next = addReading(current, minutes, pages);
  try {
    const db = await getDb();
    await db.put('stats', next);
  } catch {
    // Không lưu được thống kê thì vẫn cho người dùng đọc tiếp.
  }
  return next;
}

/** Các ngày có thống kê, mới nhất trước, dùng cho phần tổng kết trong tab Tập trung. */
export async function loadRecentStats(limit = 7): Promise<DayStats[]> {
  try {
    const db = await getDb();
    const all = await db.getAll('stats');
    return all
      .map((value) => sanitizeDayStats(value))
      .filter((value): value is DayStats => value !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, Math.max(limit, 0));
  } catch {
    return [];
  }
}

export async function loadSetting<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const record = await db.get('settings', key);
    return record === undefined ? null : (record.value as T);
  } catch {
    return null;
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.put('settings', { key, value });
  } catch {
    // Không lưu được cài đặt thì vẫn cho người dùng đọc tiếp.
  }
}

/**
 * Xoá dữ liệu của một tài liệu: metadata, văn bản từng trang, mục lục, chỉ mục
 * tìm kiếm và tiến độ. Thống kê ngày và cài đặt được giữ nguyên.
 */
export async function deleteDocumentData(docId: string): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ['documents', 'pages', 'toc', 'searchIndex', 'progress'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('documents').delete(docId),
      tx.objectStore('progress').delete(docId),
      tx.objectStore('toc').delete(docId),
      tx.objectStore('searchIndex').delete(docId),
    ]);
    let cursor = await tx.objectStore('pages').index('by-doc').openCursor(IDBKeyRange.only(docId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
    return true;
  } catch {
    return false;
  }
}

/**
 * Xoá toàn bộ dữ liệu đọc đã lưu trên máy: tài liệu, văn bản, mục lục, chỉ mục
 * tìm kiếm, tiến độ và thống kê. Cài đặt giao diện/tốc độ đọc được giữ nguyên.
 */
export async function clearAllData(): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ['documents', 'pages', 'toc', 'searchIndex', 'progress', 'stats'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('documents').clear(),
      tx.objectStore('pages').clear(),
      tx.objectStore('toc').clear(),
      tx.objectStore('searchIndex').clear(),
      tx.objectStore('progress').clear(),
      tx.objectStore('stats').clear(),
    ]);
    await tx.done;
    return true;
  } catch {
    return false;
  }
}
