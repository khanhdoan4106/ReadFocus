import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useState } from 'preact/hooks';
import { buildOcrOptions } from '../../core/ocr/options';
import {
  buildOcrPageRecords,
  isLowConfidence,
  pagesToRecognize,
  unionIndexRange,
  type PageRange,
} from '../../core/ocr/pages';
import { runOcr, withOcrEngine } from '../../core/ocr/run';
import type { OcrPageView } from '../../core/ocr/types';
import { vi } from '../../i18n/vi';
import { loadOcrPages, savePageTexts } from '../../storage/db';
import { type OcrReport } from '../OcrPanel';
import { readTextLayers, renderPageForOcr } from '../ocr';

import type { RefObject } from 'preact';
import type { RunScope } from './useRunScope';

type Input = {
  docRef: RefObject<PDFDocumentProxy | null>;
  docId: string | null;
  scope: RunScope;
  /** Văn bản OCR đã lưu, dùng thay cho lớp chữ trống khi lập chỉ mục. */
  ocrTextRef: RefObject<Map<number, string>>;
  /** Khoảng trang đã lập chỉ mục gần nhất, để lập lại sau OCR. */
  indexedRangeRef: RefObject<PageRange | null>;
  runExtraction: (
    pdfDoc: PDFDocumentProxy,
    from: number,
    to: number,
    id: string | null,
  ) => Promise<void>;
};

export function useOcr({
  docRef,
  docId,
  scope,
  ocrTextRef,
  indexedRangeRef,
  runExtraction,
}: Input) {
  // Trang đã nhận dạng bằng OCR (kèm hộp bao từ) để tô kết quả tìm kiếm.
  const [ocrPages, setOcrPages] = useState<ReadonlyMap<number, OcrPageView>>(new Map());
  const [ocrProgress, setOcrProgress] = useState<{ done: number; total: number } | null>(null);
  const [ocrReport, setOcrReport] = useState<OcrReport | null>(null);

  const handleStartOcr = useCallback(
    async (range: PageRange) => {
      const pdfDoc = docRef.current;
      const runDocId = docId;
      if (!pdfDoc || !runDocId || scope.ocrAbortRef.current) return;

      const getUrl = typeof chrome !== 'undefined' ? chrome.runtime?.getURL : undefined;
      if (!getUrl) {
        setOcrReport({
          recognized: 0,
          nothingToDo: false,
          cancelled: false,
          failedPages: [],
          lowConfidencePages: [],
          error: vi.ocrEngineError,
        });
        return;
      }

      const generation = scope.generationRef.current;
      // Giữ đúng bản đồ của tài liệu đang OCR, không ghi nhầm sang tài liệu khác.
      const ocrText = ocrTextRef.current;
      const abort = new AbortController();
      scope.ocrAbortRef.current = abort;
      const isActive = () =>
        scope.ocrAbortRef.current === abort && scope.generationRef.current === generation;
      const report: OcrReport = {
        recognized: 0,
        nothingToDo: false,
        cancelled: false,
        failedPages: [],
        lowConfidencePages: [],
        error: null,
      };
      setOcrReport(null);
      setOcrProgress({ done: 0, total: range.to - range.from + 1 });

      try {
        const layers = await readTextLayers(pdfDoc, range);
        if (!isActive()) return;
        const todo = pagesToRecognize(range, layers).filter((page) => !ocrText.has(page));
        if (todo.length === 0) {
          report.nothingToDo = true;
          return;
        }
        setOcrProgress({ done: 0, total: todo.length });

        const { createTesseractEngine } = await import('../../core/ocr/tesseract-engine');
        const options = buildOcrOptions((path) => getUrl.call(chrome.runtime, path));
        const outcome = await withOcrEngine(
          () => createTesseractEngine(options),
          (engine) =>
            runOcr({
              engine,
              pages: todo,
              signal: abort.signal,
              renderPage: (page, signal) => renderPageForOcr(pdfDoc, page, signal),
              onProgress: (progress) => {
                if (isActive()) setOcrProgress({ done: progress.done, total: progress.total });
              },
              onPage: async (page, result) => {
                const [record] = buildOcrPageRecords(new Map([[page, result]]));
                if (!record) return;
                await savePageTexts(runDocId, [record]);
                if (!isActive()) return;
                report.recognized += 1;
                if (isLowConfidence(record.confidence)) report.lowConfidencePages.push(page);
                ocrText.set(page, record.text);
                setOcrPages((current) =>
                  new Map(current).set(page, { confidence: record.confidence, ...record.ocr }),
                );
              },
            }),
        );
        report.failedPages = outcome.failed;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          report.cancelled = true;
        } else {
          report.error = vi.ocrEngineError;
        }
      } finally {
        if (isActive()) {
          scope.ocrAbortRef.current = null;
          setOcrProgress(null);
          setOcrReport(report);
          // Trang vừa nhận dạng có chữ: lập lại phân loại, mục lục, chỉ mục và thời gian đọc.
          if (report.recognized > 0) {
            const next = unionIndexRange(indexedRangeRef.current, range);
            void runExtraction(pdfDoc, next.from, next.to, runDocId);
          }
        }
      }
    },
    [docId, runExtraction],
  );

  const handleCancelOcr = useCallback(() => {
    scope.ocrAbortRef.current?.abort();
  }, []);

  /** Xoá tiến độ và báo cáo của lượt OCR (mở file khác, đóng, xoá dữ liệu). */
  const clear = useCallback(() => {
    setOcrProgress(null);
    setOcrReport(null);
  }, []);

  /** Nạp chữ OCR đã lưu của tài liệu vừa mở. */
  const load = useCallback(
    async (hash: string | null) => {
      const savedOcr = hash ? await loadOcrPages(hash) : [];
      ocrTextRef.current = new Map(savedOcr.map((page) => [page.page, page.text]));
      setOcrPages(
        new Map(
          savedOcr.flatMap((page) =>
            page.ocr
              ? [[page.page, { confidence: page.confidence ?? 0, ...page.ocr }] as const]
              : [],
          ),
        ),
      );
    },
    [ocrTextRef],
  );

  /** Bỏ chữ OCR của tài liệu đã đóng hoặc đã xoá. */
  const forget = useCallback(() => {
    ocrTextRef.current = new Map();
    setOcrPages(new Map());
  }, [ocrTextRef]);

  return {
    pages: ocrPages,
    progress: ocrProgress,
    report: ocrReport,
    start: handleStartOcr,
    cancel: handleCancelOcr,
    clear,
    load,
    forget,
  };
}
