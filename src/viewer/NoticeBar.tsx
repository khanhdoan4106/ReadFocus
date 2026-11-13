import type { useExtraction } from './hooks/useExtraction';
import type { useOcr } from './hooks/useOcr';
import { t } from '../i18n';
import { INDEX_PAGE_LIMIT } from './extract';
import { OcrPanel } from './OcrPanel';

type Props = {
  ready: boolean;
  pageNumber: number;
  totalPages: number;
  extraction: ReturnType<typeof useExtraction>;
  ocr: ReturnType<typeof useOcr>;
  onStartIndexing: () => void;
};

/** Thanh thông báo dưới thanh công cụ: chọn khoảng trang, tiến độ lập chỉ mục, cảnh báo bản scan, OCR. */
export function NoticeBar({
  ready,
  pageNumber,
  totalPages,
  extraction,
  ocr,
  onStartIndexing,
}: Props) {
  const { analysis, indexRange, setIndexRange, rangeError, extractedPages } = extraction;
  const ocrPages = ocr.pages;
  const ocrProgress = ocr.progress;
  const ocrReport = ocr.report;
  // Có trang chưa có lớp chữ (bản scan) hoặc đã từng OCR thì cho nhận dạng chữ.
  const showOcrPanel =
    ready &&
    analysis.phase === 'done' &&
    (analysis.profile.isScanned ||
      ocrPages.size > 0 ||
      extractedPages.some((page) => page.text.trim() === ''));
  const showNotice =
    ready &&
    (indexRange !== null ||
      analysis.phase === 'extracting' ||
      analysis.phase === 'error' ||
      (analysis.phase === 'done' && analysis.profile.isScanned) ||
      showOcrPanel ||
      ocrProgress !== null);

  if (!showNotice) return null;

  return (
    <section class="notice" aria-live="polite">
      {indexRange && (
        <form
          class="notice__form"
          onSubmit={(event) => {
            event.preventDefault();
            onStartIndexing();
          }}
        >
          <p class="notice__text">{t.longDocWarning(INDEX_PAGE_LIMIT)}</p>
          <label class="notice__field">
            {t.indexFrom}
            <input
              type="number"
              min={1}
              max={totalPages}
              value={indexRange.from}
              onInput={(event) => setIndexRange({ ...indexRange, from: event.currentTarget.value })}
            />
          </label>
          <label class="notice__field">
            {t.indexTo}
            <input
              type="number"
              min={1}
              max={totalPages}
              value={indexRange.to}
              onInput={(event) => setIndexRange({ ...indexRange, to: event.currentTarget.value })}
            />
          </label>
          <button type="submit" class="notice__button">
            {t.indexStart}
          </button>
          {rangeError && (
            <p class="notice__error" role="alert">
              {rangeError}
            </p>
          )}
        </form>
      )}

      {analysis.phase === 'extracting' && (
        <div class="notice__progress">
          <progress value={analysis.done} max={analysis.total} />
          <span>{t.extracting(analysis.done, analysis.total)}</span>
        </div>
      )}

      {analysis.phase === 'done' && analysis.profile.isScanned && (
        <p class="notice__text notice__text--warning">{t.scannedWarning}</p>
      )}

      {(showOcrPanel || ocrProgress !== null) && (
        <OcrPanel
          currentPage={pageNumber}
          pageCount={totalPages}
          running={ocrProgress}
          report={ocrReport}
          hasOcrPages={ocrPages.size > 0}
          onStart={(range) => void ocr.start(range)}
          onCancel={ocr.cancel}
        />
      )}

      {analysis.phase === 'error' && (
        <p class="notice__text notice__text--warning" role="alert">
          {t.extractFailed}
        </p>
      )}
    </section>
  );
}
