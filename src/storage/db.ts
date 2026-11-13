import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { sanitizeProgress, type SavedProgress } from '../core/progress';
import {
  addReading,
  emptyDayStats,
  localDateKey,
  sanitizeDayStats,
  type DayStats,
} from '../core/stats';
import { sanitizeCard } from '../core/flashcard/leitner';
import type { Card } from '../core/flashcard/types';
import { sanitizeAnnotation } from '../core/annotate/record';
import type { Annotation } from '../core/annotate/types';
import type { QaRecord } from '../core/ask/types';
import type { EmbeddingRecord } from '../core/embed/types';
import type { OcrPageRecord } from '../core/ocr/pages';
import { sanitizeSummaryRecord, type SummaryRecord } from '../core/summarize/record';

const DB_NAME = 'readfocus';
/**
 * Version 2 thêm store `summaries` (cache tóm tắt AI). Version 3 thêm `embeddings`,
 * `qa` và `flashcards` cho v2; store `pages` nhận thêm trường tuỳ chọn của OCR. Version 4 thêm
 * `annotations` (ghi chú và highlight của người dùng).
 */
const DB_VERSION = 4;

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
  /** Mặc định (không có trường) là lớp chữ của PDF. */
  source?: 'pdf' | 'ocr';
  /** Độ tin cậy trung bình 0–100, chỉ có với trang OCR. */
  confidence?: number;
  /** Hộp bao từng từ, chỉ có với trang OCR; dùng để tô kết quả tìm kiếm. */
  ocr?: OcrPageRecord['ocr'];
};

/**
 * Bản ghi của các store v2 (`embeddings`, `qa`, `flashcards`). Mỗi store có
 * khoá `id` và index `by-doc`; các trường riêng do từng tính năng định nghĩa.
 */
export type DocScopedRecord = { id: string; docId: string } & Record<string, unknown>;
export type { EmbeddingRecord };
export type { QaRecord };
export type FlashcardRecord = Card;

/** Các store có index `by-doc`, bị xoá cùng tài liệu. */
const DOC_SCOPED_STORES = ['summaries', 'embeddings', 'qa', 'flashcards'] as const;

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
  summaries: {
    key: string;
    value: SummaryRecord;
    indexes: { 'by-doc': string };
  };
  embeddings: {
    key: string;
    value: EmbeddingRecord;
    indexes: { 'by-doc': string };
  };
  qa: {
    key: string;
    value: QaRecord;
    indexes: { 'by-doc': string };
  };
  flashcards: {
    key: string;
    value: FlashcardRecord;
    indexes: { 'by-doc': string };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-doc': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ReadFocusDB>> | null = null;

/** Dùng trong test để xoá cache kết nối IndexedDB. */
export function _resetDbForTest(): void {
  if (dbPromise) {
    void dbPromise.then((db) => db.close());
    dbPromise = null;
  }
}

function getDb(): Promise<IDBPDatabase<ReadFocusDB>> {
  dbPromise ??= openDB<ReadFocusDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('documents', { keyPath: 'id' });
        const pages = db.createObjectStore('pages', { keyPath: ['docId', 'page'] });
        pages.createIndex('by-doc', 'docId');
        db.createObjectStore('toc', { keyPath: 'docId' });
        db.createObjectStore('searchIndex', { keyPath: 'docId' });
        db.createObjectStore('progress', { keyPath: 'docId' });
        db.createObjectStore('stats', { keyPath: 'date' });
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        const summaries = db.createObjectStore('summaries', { keyPath: 'id' });
        summaries.createIndex('by-doc', 'docId');
      }
      if (oldVersion < 3) {
        for (const name of ['embeddings', 'qa', 'flashcards'] as const) {
          db.createObjectStore(name, { keyPath: 'id' }).createIndex('by-doc', 'docId');
        }
      }
      if (oldVersion < 4) {
        db.createObjectStore('annotations', { keyPath: 'id' }).createIndex('by-doc', 'docId');
      }
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

/**
 * Xoá văn bản đã trích của một tài liệu trước khi lập chỉ mục lại. Trang OCR
 * được giữ lại (trừ khi `keepOcr` là false) vì nhận dạng lại tốn thời gian và
 * trang scan không có lớp chữ để trích lại.
 */
export async function clearPageTexts(docId: string, keepOcr = true): Promise<void> {
  try {
    const db = await getDb();
    const pages = await db.getAllFromIndex('pages', 'by-doc', docId);
    const tx = db.transaction('pages', 'readwrite');
    for (const page of pages) {
      if (keepOcr && page.source === 'ocr') continue;
      void tx.store.delete([page.docId, page.page]);
    }
    await tx.done;
  } catch {
    // Lập chỉ mục lại vẫn ghi đè được các trang cũ; lỗi xoá không chặn việc đọc.
  }
}

export async function savePageTexts(
  docId: string,
  pages: readonly Omit<PageText, 'docId'>[],
): Promise<void> {
  if (pages.length === 0) return;

  try {
    const db = await getDb();
    const tx = db.transaction('pages', 'readwrite');
    for (const page of pages) {
      void tx.store.put({ ...page, docId });
    }
    await tx.done;
  } catch {
    // Không lưu được văn bản thì vẫn cho người dùng đọc tiếp.
  }
}

/** Trang OCR đã lưu của một tài liệu (kèm hộp bao từ), theo thứ tự trang. */
export async function loadOcrPages(docId: string): Promise<PageText[]> {
  try {
    const db = await getDb();
    const pages = await db.getAllFromIndex('pages', 'by-doc', docId);
    return pages.filter((page) => page.source === 'ocr').sort((a, b) => a.page - b.page);
  } catch {
    return [];
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
 * Lưu kết quả tóm tắt vào cache. Lỗi lưu trữ không được chặn việc hiển thị:
 * người dùng vẫn thấy kết quả vừa tạo, chỉ lần sau phải gọi lại API.
 */
export async function saveSummary(record: SummaryRecord): Promise<void> {
  try {
    const db = await getDb();
    await db.put('summaries', record);
  } catch {
    // Không lưu được cache thì vẫn hiển thị kết quả.
  }
}

export async function loadSummary(id: string): Promise<SummaryRecord | null> {
  try {
    const db = await getDb();
    return sanitizeSummaryRecord(await db.get('summaries', id));
  } catch {
    return null;
  }
}

/** Tất cả tóm tắt đã lưu của một tài liệu (dùng để đánh dấu trong mục lục). */
export async function loadSummariesForDoc(docId: string): Promise<SummaryRecord[]> {
  try {
    const db = await getDb();
    const records = await db.getAllFromIndex('summaries', 'by-doc', docId);
    return records
      .map((record) => sanitizeSummaryRecord(record))
      .filter((record): record is SummaryRecord => record !== null);
  } catch {
    return [];
  }
}

/** Lưu một lô vector; ghi đè bản ghi cùng `id`. Lỗi lưu không chặn việc tìm kiếm. */
export async function saveEmbeddings(records: readonly EmbeddingRecord[]): Promise<void> {
  if (records.length === 0) return;
  try {
    const db = await getDb();
    const tx = db.transaction('embeddings', 'readwrite');
    for (const record of records) void tx.store.put(record);
    await tx.done;
  } catch {
    // Không lưu được vector thì lần sau tính lại.
  }
}

/** Vector của một tài liệu theo đúng khoá nguồn; vector của nguồn khác bị bỏ. */
export async function loadEmbeddings(docId: string, key: string): Promise<EmbeddingRecord[]> {
  try {
    const db = await getDb();
    const records = await db.getAllFromIndex('embeddings', 'by-doc', docId);
    return records.filter(
      (record) =>
        record.key === key && record.vector instanceof Float32Array && record.vector.length > 0,
    );
  } catch {
    return [];
  }
}

/** Xoá toàn bộ vector của một tài liệu (mọi nguồn). */
export async function deleteEmbeddingsForDoc(docId: string): Promise<void> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('embeddings', 'by-doc', docId);
    const tx = db.transaction('embeddings', 'readwrite');
    for (const key of keys) void tx.store.delete(key);
    await tx.done;
  } catch {
    // Bỏ qua: vector thừa không ảnh hưởng kết quả vì được lọc theo khoá nguồn.
  }
}

export async function saveQa(record: QaRecord): Promise<void> {
  try {
    const db = await getDb();
    await db.put('qa', record);
  } catch {
    // Không lưu được lịch sử thì vẫn hiện câu trả lời.
  }
}

/** Lịch sử hỏi đáp của một tài liệu, mới nhất trước. */
export async function loadQa(docId: string): Promise<QaRecord[]> {
  try {
    const db = await getDb();
    const records = await db.getAllFromIndex('qa', 'by-doc', docId);
    return records
      .filter((record) => typeof record.question === 'string' && typeof record.answer === 'string')
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteQa(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('qa', id);
  } catch {
    // Bỏ qua: mục còn lại sẽ hiện lần sau.
  }
}

export async function clearQaForDoc(docId: string): Promise<void> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('qa', 'by-doc', docId);
    const tx = db.transaction('qa', 'readwrite');
    for (const key of keys) void tx.store.delete(key);
    await tx.done;
  } catch {
    // Bỏ qua.
  }
}

/** Ghi (thêm hoặc cập nhật) một lô thẻ. */
export async function saveFlashcards(cards: readonly Card[]): Promise<void> {
  if (cards.length === 0) return;
  try {
    const db = await getDb();
    const tx = db.transaction('flashcards', 'readwrite');
    for (const card of cards) void tx.store.put(card);
    await tx.done;
  } catch {
    // Không lưu được thì thẻ vẫn hiện trong phiên này.
  }
}

export async function loadFlashcards(docId: string): Promise<Card[]> {
  try {
    const db = await getDb();
    const records = await db.getAllFromIndex('flashcards', 'by-doc', docId);
    return records
      .map(sanitizeCard)
      .filter((card): card is Card => card !== null)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function deleteFlashcard(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('flashcards', id);
  } catch {
    // Bỏ qua.
  }
}

export async function clearFlashcardsForDoc(docId: string): Promise<void> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('flashcards', 'by-doc', docId);
    const tx = db.transaction('flashcards', 'readwrite');
    for (const key of keys) void tx.store.delete(key);
    await tx.done;
  } catch {
    // Bỏ qua.
  }
}

/** Ghi (thêm hoặc cập nhật) một lô ghi chú/highlight. Trả `false` nếu không lưu được. */
export async function saveAnnotations(records: readonly Annotation[]): Promise<boolean> {
  if (records.length === 0) return true;
  try {
    const db = await getDb();
    const tx = db.transaction('annotations', 'readwrite');
    for (const record of records) void tx.store.put(record);
    await tx.done;
    return true;
  } catch {
    return false;
  }
}

/** Ghi chú của một tài liệu; bản ghi hỏng bị bỏ qua (không xoá). Theo trang rồi theo thời gian tạo. */
export async function loadAnnotations(docId: string): Promise<Annotation[]> {
  try {
    const db = await getDb();
    const records = await db.getAllFromIndex('annotations', 'by-doc', docId);
    return records
      .map(sanitizeAnnotation)
      .filter((record): record is Annotation => record !== null)
      .sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function countAnnotationsForDoc(docId: string): Promise<number> {
  try {
    const db = await getDb();
    return await db.countFromIndex('annotations', 'by-doc', docId);
  } catch {
    return 0;
  }
}

/** Xoá một ghi chú. Giao diện phải hỏi xác nhận trước khi gọi. */
export async function deleteAnnotation(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db.delete('annotations', id);
    return true;
  } catch {
    return false;
  }
}

/** Xoá mọi ghi chú và highlight của mọi tài liệu. Chỉ gọi sau xác nhận hai lần. */
export async function clearAllAnnotations(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.clear('annotations');
    return true;
  } catch {
    return false;
  }
}

/**
 * Xoá dữ liệu của một tài liệu: metadata, văn bản từng trang (kể cả OCR), mục
 * lục, chỉ mục tìm kiếm, tiến độ, tóm tắt AI, embedding, hỏi đáp, flashcard và ghi chú/highlight
 * của tài liệu đó (giao diện phải nói rõ và hỏi xác nhận trước). Thống kê ngày và cài đặt được giữ nguyên.
 */
export async function deleteDocumentData(docId: string): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ['documents', 'pages', 'toc', 'searchIndex', 'progress', 'annotations', ...DOC_SCOPED_STORES],
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
    for (const name of [...DOC_SCOPED_STORES, 'annotations'] as const) {
      let docCursor = await tx
        .objectStore(name)
        .index('by-doc')
        .openCursor(IDBKeyRange.only(docId));
      while (docCursor) {
        await docCursor.delete();
        docCursor = await docCursor.continue();
      }
    }
    await tx.done;
    return true;
  } catch {
    return false;
  }
}

/**
 * Xoá toàn bộ dữ liệu đọc đã lưu trên máy: tài liệu, văn bản, mục lục, chỉ mục
 * tìm kiếm, tiến độ, thống kê, tóm tắt AI, embedding, hỏi đáp và flashcard. Cài đặt giao diện/tốc độ đọc,
 * API key và GHI CHÚ/HIGHLIGHT được giữ nguyên (đó là nội dung người dùng tự tạo; xoá riêng bằng
 * `clearAllAnnotations`).
 */
export async function clearAllData(): Promise<boolean> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ['documents', 'pages', 'toc', 'searchIndex', 'progress', 'stats', ...DOC_SCOPED_STORES],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('documents').clear(),
      tx.objectStore('pages').clear(),
      tx.objectStore('toc').clear(),
      tx.objectStore('searchIndex').clear(),
      tx.objectStore('progress').clear(),
      tx.objectStore('stats').clear(),
      ...DOC_SCOPED_STORES.map((name) => tx.objectStore(name).clear()),
    ]);
    await tx.done;
    return true;
  } catch {
    return false;
  }
}
