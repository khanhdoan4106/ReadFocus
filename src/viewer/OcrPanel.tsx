import { useState } from 'preact/hooks';
import {
  defaultOcrRange,
  OCR_MAX_PAGES,
  validateOcrRange,
  type PageRange,
} from '../core/ocr/pages';
import { vi } from '../i18n/vi';

export type OcrReport = {
  recognized: number;
  /** Không có trang nào cần nhận dạng trong khoảng đã chọn. */
  nothingToDo: boolean;
  cancelled: boolean;
  failedPages: number[];
  lowConfidencePages: number[];
  /** Câu báo lỗi khi không chạy được (đã là tiếng Việt). */
  error: string | null;
};

export type OcrPanelProps = {
  currentPage: number;
  pageCount: number;
  running: { done: number; total: number } | null;
  report: OcrReport | null;
  /** Tài liệu đã có trang OCR (hiện lời nhắc chữ có thể sai). */
  hasOcrPages: boolean;
  onStart: (range: PageRange) => void;
  onCancel: () => void;
};

function listPages(pages: readonly number[]): string {
  return pages.join(', ');
}

export function OcrPanel({
  currentPage,
  pageCount,
  running,
  report,
  hasOcrPages,
  onStart,
  onCancel,
}: OcrPanelProps) {
  const initial = defaultOcrRange(currentPage, pageCount);
  const [from, setFrom] = useState(String(initial.from));
  const [to, setTo] = useState(String(initial.to));
  const [rangeError, setRangeError] = useState<string | null>(null);

  const submit = (event: Event) => {
    event.preventDefault();
    const result = validateOcrRange(Number(from), Number(to), pageCount);
    if (!result.ok) {
      setRangeError(
        result.error === 'too-long'
          ? vi.ocrRangeTooLong(OCR_MAX_PAGES)
          : result.error === 'out-of-bounds'
            ? vi.ocrRangeOutOfBounds(pageCount)
            : vi.ocrRangeInvalid,
      );
      return;
    }
    setRangeError(null);
    onStart(result.range);
  };

  return (
    <div class="ocr-panel">
      <p class="notice__text">{vi.ocrHint}</p>

      {running ? (
        <div class="notice__progress">
          <progress value={running.done} max={running.total} />
          <span>{vi.ocrRunning(running.done, running.total)}</span>
          <button type="button" class="notice__button" onClick={onCancel}>
            {vi.ocrCancel}
          </button>
        </div>
      ) : (
        <form class="notice__form" onSubmit={submit}>
          <label class="notice__field">
            {vi.indexFrom}
            <input
              type="number"
              min={1}
              max={pageCount}
              value={from}
              onInput={(event) => setFrom(event.currentTarget.value)}
            />
          </label>
          <label class="notice__field">
            {vi.indexTo}
            <input
              type="number"
              min={1}
              max={pageCount}
              value={to}
              onInput={(event) => setTo(event.currentTarget.value)}
            />
          </label>
          <button type="submit" class="notice__button">
            {vi.ocrStart}
          </button>
        </form>
      )}

      {rangeError && (
        <p class="notice__error" role="alert">
          {rangeError}
        </p>
      )}

      {report && !running && (
        <div class="ocr-panel__report" role="status">
          {report.error && <p class="notice__error">{report.error}</p>}
          {report.nothingToDo && <p class="notice__text">{vi.ocrNothingToDo}</p>}
          {report.cancelled && <p class="notice__text">{vi.ocrCancelled}</p>}
          {!report.error && !report.nothingToDo && report.recognized > 0 && (
            <p class="notice__text">{vi.ocrDone(report.recognized)}</p>
          )}
          {report.failedPages.length > 0 && (
            <p class="notice__error">{vi.ocrFailedPages(listPages(report.failedPages))}</p>
          )}
          {report.lowConfidencePages.length > 0 && (
            <p class="notice__text notice__text--warning">
              {vi.ocrLowConfidence(listPages(report.lowConfidencePages))}
            </p>
          )}
        </div>
      )}

      {hasOcrPages && !running && <p class="notice__text">{vi.ocrReviewNote}</p>}
    </div>
  );
}
