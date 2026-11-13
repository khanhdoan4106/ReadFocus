import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { sha256Hex } from '../../core/hash';
import { clampPage, fitWidthScale, stepZoom } from '../../core/pagination';
import { fileNameFromUrl, isFileUrl } from '../../core/pdf-url';
import { readRequestedPdfUrl } from '../../core/pdf-redirect';
import { acceptPageReport, canPersistProgress } from '../../core/progress';
import { vi } from '../../i18n/vi';
import {
  clearAllData,
  deleteDocumentData,
  loadProgress,
  recordDocumentOpen,
  saveProgress,
} from '../../storage/db';
import { type PageSize } from '../PageList';
import { openPdfData, readPdfFile } from '../pdf';

import { type ErrorReason } from '../labels';
import type { RefObject } from 'preact';

type Status = 'empty' | 'opening' | 'ready' | 'error';
const FALLBACK_PAGE_SIZE: PageSize = { width: 612, height: 792 };

async function hashData(data: ArrayBuffer): Promise<string | null> {
  try {
    return await sha256Hex(data);
  } catch {
    // Không băm được vẫn phải cho đọc, chỉ là không lưu/khôi phục tiến độ.
    return null;
  }
}

/**
 * Việc cần làm ở các miền khác khi tài liệu được mở, đóng hoặc xoá. App gắn các hàm này
 * sau khi dựng xong mọi hook; `useDocument` luôn gọi bản mới nhất.
 */
export type DocumentLifecycle = {
  stopBackground: () => void;
  restoreOcr: (hash: string | null) => Promise<void>;
  restartClock: (page: number) => void;
  openSummaries: (hash: string | null) => void;
  beginAnalysis: (pdfDoc: PDFDocumentProxy, hash: string | null) => void;
  invalidateAnalysis: () => void;
  clearAnalysis: () => void;
  clearRange: () => void;
  forgetSummaries: () => void;
  forgetOcr: () => void;
  resetStats: () => void;
};

type Input = {
  lifecycle: RefObject<DocumentLifecycle>;
  showToast: (message: string) => void;
};

/** Tài liệu đang mở: mở file hoặc địa chỉ, trang hiện tại, zoom, tiến độ đã lưu, xoá dữ liệu. */
export function useDocument({ lifecycle, showToast }: Input) {
  const [status, setStatus] = useState<Status>('empty');
  const [error, setError] = useState<ErrorReason>('unknown');
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageDraft, setPageDraft] = useState('1');
  const [scale, setScale] = useState(1);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [highlight, setHighlight] = useState<{
    page: number;
    query: string;
    ignoreDiacritics: boolean;
    quote?: boolean;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const closeRef = useRef<(() => Promise<void>) | null>(null);
  const pageNumberRef = useRef(pageNumber);
  pageNumberRef.current = pageNumber;
  // Trang đích trong lúc chờ nhảy tới tiến độ đã lưu; `null` khi không khôi phục.
  const restoringRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      lifecycle.current.invalidateAnalysis();
      void closeRef.current?.();
      closeRef.current = null;
      docRef.current = null;
    };
  }, []);

  useEffect(() => {
    setPageDraft(String(pageNumber));
  }, [pageNumber]);

  const scrollToPage = useCallback((page: number) => {
    const scroller = contentRef.current;
    const slot = scroller?.querySelector<HTMLElement>(`.page-slot[data-page="${page}"]`);
    if (scroller && slot) {
      scroller.scrollTo({ top: Math.max(slot.offsetTop - 8, 0) });
    }
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      const target = clampPage(next, docRef.current?.numPages ?? 1);
      setPageNumber(target);
      scrollToPage(target);
    },
    [scrollToPage],
  );

  const handleSearchResult = useCallback(
    (page: number, query: string, ignoreDiacritics: boolean) => {
      goToPage(page);
      setHighlight({ page, query, ignoreDiacritics });
    },
    [goToPage],
  );

  const handleCitation = useCallback(
    (page: number, quote: string) => {
      goToPage(page);
      setHighlight({ page, query: quote, ignoreDiacritics: true, quote: true });
    },
    [goToPage],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setStatus('opening');
      const read = await readPdfFile(file);

      if (!read.ok) {
        setError(read.reason);
        setStatus('error');
        return;
      }

      const [result, hash] = await Promise.all([openPdfData(read.data), hashData(read.data)]);

      if (!result.ok) {
        setError(result.reason);
        setStatus('error');
        return;
      }

      // Dừng OCR/tóm tắt của tài liệu cũ trước mọi bước await tiếp theo, để kết quả về
      // muộn không lẫn vào tài liệu mới.
      lifecycle.current.stopBackground();
      await closeRef.current?.();
      docRef.current = result.doc;
      closeRef.current = result.close;

      await lifecycle.current.restoreOcr(hash);

      const baseViewport = (await result.doc.getPage(1)).getViewport({ scale: 1 });
      const availableWidth = (contentRef.current?.clientWidth ?? 0) - 48;
      const stored = hash ? await loadProgress(hash, result.doc.numPages) : null;
      const resumePage = stored?.page ?? 1;

      // Chặn báo cáo trang và ghi tiến độ cho tới khi cuộn xong tới trang khôi phục.
      restoringRef.current = resumePage > 1 ? resumePage : null;

      setDoc(result.doc);
      setDocId(hash);
      setFileName(file.name);
      setPageNumber(resumePage);
      setPageDraft(String(resumePage));
      setPageSizes({ 1: { width: baseViewport.width, height: baseViewport.height } });
      setScale(availableWidth > 0 ? fitWidthScale(baseViewport.width, availableWidth) : 1);
      setStatus('ready');

      // Tài liệu mới: bỏ mẫu đọc của tài liệu trước, bắt đầu đo từ trang khôi phục.
      lifecycle.current.restartClock(resumePage);

      if (hash) {
        void recordDocumentOpen({
          id: hash,
          name: file.name,
          size: file.size,
          pageCount: result.doc.numPages,
        });
      }
      lifecycle.current.openSummaries(hash);
      lifecycle.current.stopBackground();
      setHighlight(null);
      lifecycle.current.beginAnalysis(result.doc, hash);

      if (resumePage > 1) {
        setTimeout(() => {
          scrollToPage(resumePage);
          setPageNumber(resumePage);
          restoringRef.current = null;
        }, 0);
      }
    },
    [scrollToPage],
  );

  const openFromUrl = useCallback(
    async (url: string) => {
      if (isFileUrl(url)) {
        setError('file-url');
        setStatus('error');
        return;
      }

      setStatus('opening');
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], fileNameFromUrl(url), {
          type: blob.type || 'application/pdf',
        });
        await handleFile(file);
      } catch {
        setError('fetch');
        setStatus('error');
      }
    },
    [handleFile],
  );

  // Mở PDF do context menu hoặc nút toolbar trên trang PDF đưa sang.
  useEffect(() => {
    const requested = readRequestedPdfUrl(window.location.search);
    if (requested === null) return;
    void openFromUrl(requested);
  }, [openFromUrl]);

  const handleMeasured = useCallback((page: number, size: PageSize) => {
    setPageSizes((previous) => {
      const existing = previous[page];
      if (
        existing &&
        Math.abs(existing.width - size.width) < 0.5 &&
        Math.abs(existing.height - size.height) < 0.5
      ) {
        return previous;
      }
      return { ...previous, [page]: size };
    });
  }, []);

  const handleRenderError = useCallback(() => {
    setError('render');
    setStatus('error');
  }, []);

  const handleCurrentPageChange = useCallback((page: number) => {
    const accepted = acceptPageReport(page, restoringRef.current);
    if (accepted !== null) setPageNumber(accepted);
  }, []);

  // Ghi tiến độ sau khi người dùng dừng cuộn một nhịp, tránh ghi IndexedDB liên tục.
  useEffect(() => {
    if (status !== 'ready' || !docId) return;
    const timer = setTimeout(() => {
      if (!canPersistProgress(restoringRef.current)) return;
      void saveProgress(docId, pageNumber);
    }, 400);
    return () => clearTimeout(timer);
  }, [docId, pageNumber, status]);

  /** Đóng tài liệu đang mở và xoá trạng thái phân tích trong bộ nhớ. */
  const resetDocument = useCallback(async () => {
    lifecycle.current.invalidateAnalysis();
    await closeRef.current?.();
    closeRef.current = null;
    docRef.current = null;
    restoringRef.current = null;
    setDoc(null);
    setDocId(null);
    setFileName('');
    setStatus('empty');
    lifecycle.current.clearAnalysis();
    setHighlight(null);
    lifecycle.current.clearRange();
    lifecycle.current.forgetSummaries();
    lifecycle.current.forgetOcr();
    lifecycle.current.stopBackground();
  }, []);

  const handleDeleteDocument = useCallback(async () => {
    if (docId === null) return;
    if (!window.confirm(vi.deleteDocumentConfirm(fileName))) return;

    const ok = await deleteDocumentData(docId);
    if (!ok) {
      showToast(vi.deleteFailed);
      return;
    }

    // Dừng lượt trích đang chạy và bỏ chỉ mục của tài liệu vừa xoá.
    lifecycle.current.invalidateAnalysis();
    setDocId(null);
    lifecycle.current.clearAnalysis();
    lifecycle.current.forgetSummaries();
    lifecycle.current.forgetOcr();
    lifecycle.current.stopBackground();
    showToast(vi.deleteDocumentDone);
  }, [docId, fileName, showToast]);

  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm(vi.deleteAllConfirm)) return;

    const ok = await clearAllData();
    if (!ok) {
      showToast(vi.deleteFailed);
      return;
    }

    await resetDocument();
    lifecycle.current.resetStats();
    showToast(vi.deleteAllDone);
  }, [resetDocument, showToast]);

  const previousScaleRef = useRef(scale);
  const anchorPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (previousScaleRef.current === scale) return;
    previousScaleRef.current = scale;
    const target = anchorPageRef.current ?? pageNumberRef.current;
    anchorPageRef.current = null;
    const timer = setTimeout(() => {
      scrollToPage(target);
      setPageNumber(target);
    }, 0);
    return () => clearTimeout(timer);
  }, [scale, scrollToPage]);

  const handleZoom = (direction: 1 | -1) => {
    anchorPageRef.current = pageNumberRef.current;
    setScale((current) => stepZoom(current, direction));
  };

  const handleFitWidth = () => {
    if (!doc) return;
    const baseSize = pageSizes[pageNumberRef.current] ?? pageSizes[1] ?? FALLBACK_PAGE_SIZE;
    const availableWidth = (contentRef.current?.clientWidth ?? 0) - 48;
    if (availableWidth > 0) {
      anchorPageRef.current = pageNumberRef.current;
      setScale(fitWidthScale(baseSize.width, availableWidth));
    }
  };

  const commitPageDraft = () => {
    const parsed = Number.parseInt(pageDraft, 10);
    if (Number.isNaN(parsed)) {
      setPageDraft(String(pageNumber));
      return;
    }
    goToPage(parsed);
  };

  return {
    status,
    error,
    doc,
    docId,
    fileName,
    pageNumber,
    pageDraft,
    setPageDraft,
    scale,
    pageSizes,
    highlight,
    inputRef,
    contentRef,
    docRef,
    pageNumberRef,
    goToPage,
    handleFile,
    handleSearchResult,
    handleCitation,
    handleMeasured,
    handleRenderError,
    handleCurrentPageChange,
    handleZoom,
    handleFitWidth,
    commitPageDraft,
    handleDeleteDocument,
    handleDeleteAll,
    fallbackSize: pageSizes[1] ?? FALLBACK_PAGE_SIZE,
    totalPages: doc?.numPages ?? 0,
  };
}
