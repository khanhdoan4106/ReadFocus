import type { OcrPageResult, OcrWord } from './types';

/** Giới hạn số trang mỗi lần OCR, giống giới hạn lập chỉ mục của v0. */
export const OCR_MAX_PAGES = 100;
/** Số trang lấy thêm mỗi bên của trang đang đọc khi gợi ý khoảng mặc định. */
export const OCR_DEFAULT_MARGIN = 2;
/** Dưới ngưỡng này (sau khi bỏ khoảng trắng) coi như trang không có lớp chữ. */
export const MIN_TEXT_LAYER_CHARS = 10;
/** Trang có độ tin cậy trung bình thấp hơn mức này được đánh dấu. */
export const LOW_CONFIDENCE_THRESHOLD = 60;

export type PageRange = { from: number; to: number };

/** Khoảng trang gợi ý: trang đang đọc ± vài trang, kẹp theo số trang và giới hạn. */
export function defaultOcrRange(
  currentPage: number,
  pageCount: number,
  margin = OCR_DEFAULT_MARGIN,
  maxPages = OCR_MAX_PAGES,
): PageRange {
  const last = Math.max(1, Math.floor(pageCount));
  const current = Math.min(Math.max(Math.floor(currentPage) || 1, 1), last);
  const span = Math.max(0, Math.floor(margin));
  const from = Math.max(1, current - span);
  let to = Math.min(last, current + span);
  if (to - from + 1 > maxPages) to = from + maxPages - 1;
  return { from, to };
}

export type OcrRangeError = 'invalid' | 'out-of-bounds' | 'too-long';

export type OcrRangeResult = { ok: true; range: PageRange } | { ok: false; error: OcrRangeError };

/** Kiểm tra khoảng trang người dùng nhập (đã chuyển thành số). */
export function validateOcrRange(
  from: number,
  to: number,
  pageCount: number,
  maxPages = OCR_MAX_PAGES,
): OcrRangeResult {
  if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
    return { ok: false, error: 'invalid' };
  }
  if (from < 1 || to > pageCount) return { ok: false, error: 'out-of-bounds' };
  if (to - from + 1 > maxPages) return { ok: false, error: 'too-long' };
  return { ok: true, range: { from, to } };
}

export type ExistingPage = { page: number; text: string; source?: 'pdf' | 'ocr' };

/** Trang đã có lớp chữ thật (không phải kết quả OCR cũ). */
export function hasTextLayer(page: ExistingPage | undefined): boolean {
  if (!page || page.source === 'ocr') return false;
  return page.text.replace(/\s+/g, '').length >= MIN_TEXT_LAYER_CHARS;
}

/**
 * Các trang cần nhận dạng trong khoảng đã chọn. Mặc định bỏ qua trang đã có
 * lớp chữ; `force` nhận dạng lại tất cả (kể cả trang OCR trước đó).
 */
export function pagesToRecognize(
  range: PageRange,
  existing: readonly ExistingPage[],
  force = false,
): number[] {
  const byPage = new Map(existing.map((page) => [page.page, page]));
  const result: number[] = [];
  for (let page = range.from; page <= range.to; page += 1) {
    if (force || !hasTextLayer(byPage.get(page))) result.push(page);
  }
  return result;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Độ tin cậy trung bình theo số từ, bỏ từ rỗng; không có từ nào thì trả 0. */
export function averageConfidence(words: readonly Pick<OcrWord, 'text' | 'confidence'>[]): number {
  const scored = words.filter((word) => word.text.trim() !== '');
  if (scored.length === 0) return 0;
  const sum = scored.reduce((total, word) => total + clampConfidence(word.confidence), 0);
  return Math.round((sum / scored.length) * 10) / 10;
}

export function isLowConfidence(confidence: number | undefined): boolean {
  return confidence !== undefined && confidence < LOW_CONFIDENCE_THRESHOLD;
}

/** Bản ghi trang OCR để lưu vào store `pages`. */
export type OcrPageRecord = {
  page: number;
  text: string;
  source: 'ocr';
  confidence: number;
  ocr: { width: number; height: number; words: OcrWord[] };
};

/** Gộp kết quả theo thứ tự trang thành các bản ghi để lưu. */
export function buildOcrPageRecords(results: ReadonlyMap<number, OcrPageResult>): OcrPageRecord[] {
  return [...results.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, result]) => ({
      page,
      text: result.text,
      source: 'ocr' as const,
      confidence: result.confidence,
      ocr: { width: result.width, height: result.height, words: result.words },
    }));
}
