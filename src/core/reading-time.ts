export const DEFAULT_WORDS_PER_MINUTE = 200;

/** Khoảng nghỉ dài hơn mức này không được tính vào thời gian đọc. */
export const MAX_ACTIVE_GAP_MS = 2 * 60 * 1000;

/** Lần đọc một trang ngắn hơn mức này không đủ tin cậy để học tốc độ. */
export const MIN_SAMPLE_MS = 3 * 1000;

const MIN_LEARN_ACTIVE_MS = 20 * 1000;
const MIN_LEARN_WORDS = 100;
const MIN_WORDS_PER_MINUTE = 50;
const MAX_WORDS_PER_MINUTE = 1000;

export type ReadingSpeed = {
  /** Tổng thời gian đọc thực tế đã ghi nhận. */
  activeMs: number;
  /** Tổng số từ đã đọc trong thời gian đó. */
  words: number;
};

export type ReadingSample = {
  words: number;
  activeMs: number;
};

export type TocTimeItem = {
  startPage: number;
  endPage: number;
  wordCount: number;
};

export type RemainingTime = {
  sectionMinutes: number;
  totalMinutes: number;
};

export function emptyReadingSpeed(): ReadingSpeed {
  return { activeMs: 0, words: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Chuẩn hoá dữ liệu tốc độ đọc lấy từ IndexedDB. */
export function sanitizeReadingSpeed(value: unknown): ReadingSpeed {
  if (!isRecord(value)) return emptyReadingSpeed();

  const activeMs = value.activeMs;
  const words = value.words;
  if (typeof activeMs !== 'number' || !Number.isFinite(activeMs) || activeMs < 0) {
    return emptyReadingSpeed();
  }
  if (typeof words !== 'number' || !Number.isFinite(words) || words < 0) {
    return emptyReadingSpeed();
  }

  return { activeMs, words };
}

export function addReadingSample(speed: ReadingSpeed, sample: ReadingSample): ReadingSpeed {
  if (!Number.isFinite(sample.words) || !Number.isFinite(sample.activeMs)) return speed;
  if (sample.words <= 0 || sample.activeMs < MIN_SAMPLE_MS) return speed;

  return {
    activeMs: speed.activeMs + sample.activeMs,
    words: speed.words + sample.words,
  };
}

/**
 * Tốc độ đọc thực tế, chỉ tin cậy khi đã có đủ thời gian và số từ;
 * trước đó dùng tốc độ mặc định 200 từ/phút.
 */
export function wordsPerMinute(speed: ReadingSpeed, fallback = DEFAULT_WORDS_PER_MINUTE): number {
  if (speed.activeMs < MIN_LEARN_ACTIVE_MS || speed.words < MIN_LEARN_WORDS) return fallback;

  const learned = speed.words / (speed.activeMs / 60000);
  if (!Number.isFinite(learned) || learned <= 0) return fallback;

  return Math.min(Math.max(Math.round(learned), MIN_WORDS_PER_MINUTE), MAX_WORDS_PER_MINUTE);
}

/**
 * Đặt tốc độ đọc thủ công trong tab Cài đặt: quy đổi về mẫu 1 phút để
 * `wordsPerMinute` trả đúng con số người dùng chọn, và kẹp trong khoảng hợp lệ.
 */
export function speedFromWordsPerMinute(value: number): ReadingSpeed {
  const rounded = Number.isFinite(value) ? Math.round(value) : DEFAULT_WORDS_PER_MINUTE;
  const clamped = Math.min(Math.max(rounded, MIN_WORDS_PER_MINUTE), MAX_WORDS_PER_MINUTE);
  // Dùng mẫu đủ từ và đủ thời gian để `wordsPerMinute` coi là tin cậy, rồi co
  // thời gian cho khớp đúng tốc độ người dùng chọn.
  const words = Math.max(MIN_LEARN_WORDS, Math.ceil((MIN_LEARN_ACTIVE_MS * clamped) / 60_000));
  return { activeMs: Math.round((words * 60_000) / clamped), words };
}

export function estimateItemMinutes(item: TocTimeItem, wordsPerMinute_: number): number {
  if (!Number.isFinite(wordsPerMinute_) || wordsPerMinute_ <= 0) return 0;
  return Math.max(item.wordCount, 0) / wordsPerMinute_;
}

/** Làm tròn để hiển thị: dưới một phút vẫn tính là 1 phút cho dễ đọc. */
export function roundedMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (minutes < 1) return 1;
  return Math.round(minutes);
}

/**
 * Ước tính thời gian còn lại của mục đang đọc và của cả tài liệu.
 * Trong mục đang đọc, phần còn lại tính theo tỉ lệ số trang chưa đọc.
 */
export function estimateRemainingTime(
  items: readonly TocTimeItem[],
  currentPage: number,
  wordsPerMinute_: number,
): RemainingTime {
  if (!Number.isFinite(wordsPerMinute_) || wordsPerMinute_ <= 0) {
    return { sectionMinutes: 0, totalMinutes: 0 };
  }
  if (items.length === 0) return { sectionMinutes: 0, totalMinutes: 0 };

  let currentIndex = items.findIndex(
    (item) => currentPage >= item.startPage && currentPage <= item.endPage,
  );
  if (currentIndex < 0) {
    // Ngoài khoảng các mục: lấy mục gần nhất phía trước.
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if ((items[index]?.startPage ?? 0) <= currentPage) {
        currentIndex = index;
        break;
      }
    }
  }

  if (currentIndex < 0) {
    const total = items.reduce((sum, item) => sum + Math.max(item.wordCount, 0), 0);
    return { sectionMinutes: total / wordsPerMinute_, totalMinutes: total / wordsPerMinute_ };
  }

  const current = items[currentIndex];
  if (!current) return { sectionMinutes: 0, totalMinutes: 0 };

  const pageSpan = Math.max(current.endPage - current.startPage + 1, 1);
  const pagesLeft = Math.min(
    Math.max(current.endPage - Math.max(currentPage, current.startPage) + 1, 0),
    pageSpan,
  );
  const sectionWords = (Math.max(current.wordCount, 0) * pagesLeft) / pageSpan;

  const afterWords = items
    .slice(currentIndex + 1)
    .reduce((sum, item) => sum + Math.max(item.wordCount, 0), 0);

  return {
    sectionMinutes: sectionWords / wordsPerMinute_,
    totalMinutes: (sectionWords + afterWords) / wordsPerMinute_,
  };
}
