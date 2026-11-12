import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sha256Hex } from '../core/hash';
import { aiConfigProblem } from '../core/llm/settings';
import type { TextPage } from '../core/summarize/chunk';
import { hasTextLayer, type PageRange } from '../core/ocr/pages';
import { clampPage, fitWidthScale, stepZoom } from '../core/pagination';
import { fileNameFromUrl, isFileUrl } from '../core/pdf-url';
import { readRequestedPdfUrl } from '../core/pdf-redirect';
import { buildProfile, type PageSample } from '../core/profile';
import { acceptPageReport, canPersistProgress } from '../core/progress';
import { chapterEstimate } from '../core/reading-time';
import { buildSearchIndex, type SearchIndex } from '../core/search';
import { countWords } from '../core/text';
import { buildToc, type TocPage, type TocResult } from '../core/toc';
import { clampBandHeight, clampMinutes, formatTimer } from '../core/focus';
import { vi } from '../i18n/vi';
import {
  clearAllData,
  clearPageTexts,
  deleteDocumentData,
  loadProgress,
  recordDocumentOpen,
  savePageTexts,
  saveProgress,
} from '../storage/db';
import { extractRange, INDEX_PAGE_LIMIT, readOutline } from './extract';
import { OcrPanel } from './OcrPanel';
import { PageList, type PageSize } from './PageList';
import { openPdfData, readPdfFile } from './pdf';
import { Dialog } from './Dialog';
import { useAsk } from './ask';
import { useFlashcards } from './flashcards';
import { useSemanticIndex } from './semantic';
import type { Analysis } from './hooks/types';
import { useAiSettings } from './hooks/useAiSettings';
import { useFocusTimer } from './hooks/useFocusTimer';
import { useReadingStats } from './hooks/useReadingStats';
import { useOcr } from './hooks/useOcr';
import { useRunScope } from './hooks/useRunScope';
import { useSettings } from './hooks/useSettings';
import { useSummaries } from './hooks/useSummaries';
import { useShortcuts } from './hooks/useShortcuts';
import { Sidebar } from './Sidebar';

import { errorMessage, profileLabel, timerModeLabel, type ErrorReason } from './labels';

type Status = 'empty' | 'opening' | 'ready' | 'error';
type IndexRange = {
  from: string;
  to: string;
};

const FALLBACK_PAGE_SIZE: PageSize = { width: 612, height: 792 };

async function hashData(data: ArrayBuffer): Promise<string | null> {
  try {
    return await sha256Hex(data);
  } catch {
    // Không băm được vẫn phải cho đọc, chỉ là không lưu/khôi phục tiến độ.
    return null;
  }
}

export function App() {
  const [status, setStatus] = useState<Status>('empty');
  const [error, setError] = useState<ErrorReason>('unknown');
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageDraft, setPageDraft] = useState('1');
  const [scale, setScale] = useState(1);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>({ phase: 'idle' });
  const [indexRange, setIndexRange] = useState<IndexRange | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocResult | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [pageWords, setPageWords] = useState<Record<number, number>>({});
  const [highlight, setHighlight] = useState<{
    page: number;
    query: string;
    ignoreDiacritics: boolean;
    quote?: boolean;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const settings = useSettings({ showToast: setToast });
  const readingWordsPerMinute = settings.wordsPerMinute;
  const setSpeed = settings.setSpeed;
  const ai = useAiSettings();
  const aiSettings = ai.settings;
  const aiKey = ai.apiKey;
  const aiSupported = ai.supported;
  const [searchRequest, setSearchRequest] = useState(0);

  const [extractedPages, setExtractedPages] = useState<TextPage[]>([]);
  // Văn bản OCR đã lưu, dùng thay cho lớp chữ trống khi lập chỉ mục.
  const ocrTextRef = useRef<Map<number, string>>(new Map());
  // Khoảng trang đã lập chỉ mục gần nhất, để lập lại sau OCR.
  const indexedRangeRef = useRef<PageRange | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const closeRef = useRef<(() => Promise<void>) | null>(null);
  const pageNumberRef = useRef(pageNumber);
  pageNumberRef.current = pageNumber;
  // Trang đích trong lúc chờ nhảy tới tiến độ đã lưu; `null` khi không khôi phục.
  const restoringRef = useRef<number | null>(null);
  // Mỗi lần mở tài liệu hoặc lập chỉ mục lại thì tăng lên để dừng lượt trích cũ.
  const analysisTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      analysisTokenRef.current += 1;
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

  const runExtraction = useCallback(
    async (pdfDoc: PDFDocumentProxy, from: number, to: number, id: string | null) => {
      const token = analysisTokenRef.current + 1;
      analysisTokenRef.current = token;
      const total = to - from + 1;
      setRangeError(null);
      setAnalysis({ phase: 'extracting', done: 0, total });

      if (id) void clearPageTexts(id);
      indexedRangeRef.current = { from, to };

      const pending: { page: number; text: string }[] = [];
      const flush = () => {
        if (!id || pending.length === 0) return;
        void savePageTexts(id, pending.splice(0, pending.length));
      };

      try {
        const outline = await readOutline(pdfDoc);
        const outlineDepth = outline.reduce((max, entry) => Math.max(max, entry.level), 0);
        const samples: PageSample[] = [];
        const tocPages: TocPage[] = [];

        await extractRange(pdfDoc, {
          from,
          to,
          shouldStop: () => analysisTokenRef.current !== token,
          onPage: (extracted) => {
            // Trang scan đã OCR: dùng chữ OCR (đã lưu riêng, không ghi đè bản ghi OCR).
            const ocrText = ocrTextRef.current.get(extracted.page);
            const useOcr = ocrText !== undefined && !hasTextLayer(extracted);
            const page = useOcr ? { ...extracted, text: ocrText, lines: [] } : extracted;
            samples.push(page);
            tocPages.push({
              page: page.page,
              text: page.text,
              lines: page.lines,
              width: page.width,
              height: page.height,
            });
            if (!useOcr) pending.push({ page: page.page, text: page.text });
            if (pending.length >= 10) flush();
            if (analysisTokenRef.current === token) {
              setAnalysis({ phase: 'extracting', done: samples.length, total });
            }
          },
        });
        flush();

        if (analysisTokenRef.current !== token) return;
        const profile = buildProfile(samples, { outlineDepth });
        setAnalysis({ phase: 'done', profile });
        setToc(
          buildToc({
            pages: tocPages,
            outline,
            pageCount: pdfDoc.numPages,
            kind: profile.kind,
          }),
        );
        setSearchIndex(
          buildSearchIndex(tocPages.map((page) => ({ page: page.page, text: page.text }))),
        );
        setPageWords(
          Object.fromEntries(tocPages.map((page) => [page.page, countWords(page.text)])),
        );
        setExtractedPages(tocPages.map((page) => ({ page: page.page, text: page.text })));
      } catch {
        flush();
        if (analysisTokenRef.current === token) setAnalysis({ phase: 'error' });
      }
    },
    [],
  );

  /** Tài liệu dài chưa trích văn bản vẫn hiện được outline ngay. */
  const loadOutlineToc = useCallback(async (pdfDoc: PDFDocumentProxy, token: number) => {
    const outline = await readOutline(pdfDoc);
    if (analysisTokenRef.current !== token || outline.length === 0) return;
    setToc(buildToc({ pages: [], outline, pageCount: pdfDoc.numPages }));
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      const target = clampPage(next, docRef.current?.numPages ?? 1);
      setPageNumber(target);
      scrollToPage(target);
    },
    [scrollToPage],
  );

  const scope = useRunScope();
  const ocr = useOcr({ docRef, docId, scope, ocrTextRef, indexedRangeRef, runExtraction });
  const ocrPages = ocr.pages;
  const ocrProgress = ocr.progress;
  const ocrReport = ocr.report;
  const currentSection = useMemo(() => {
    if (!toc || toc.items.length === 0) return null;
    return (
      toc.items.find((item) => pageNumber >= item.startPage && pageNumber <= item.endPage) ?? null
    );
  }, [toc, pageNumber]);

  const summarize = useSummaries({
    docId,
    scope,
    ai,
    ready: status === 'ready',
    toc,
    currentSection,
    extractedPages,
    analysis,
    onSelectPage: goToPage,
  });

  /** Dừng mọi lượt tóm tắt và xoá trạng thái của chúng (mở file khác, đóng, xoá dữ liệu). */
  const resetBackgroundRuns = useCallback(() => {
    scope.stop();
    ocr.clear();
    summarize.clear();
  }, [scope.stop, ocr.clear, summarize.clear]);

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
      resetBackgroundRuns();
      await closeRef.current?.();
      docRef.current = result.doc;
      closeRef.current = result.close;

      await ocr.load(hash);

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
      stats.restartClock(resumePage);
      setPageWords({});

      if (hash) {
        void recordDocumentOpen({
          id: hash,
          name: file.name,
          size: file.size,
          pageCount: result.doc.numPages,
        });
      }
      summarize.load(hash);
      setExtractedPages([]);
      resetBackgroundRuns();

      analysisTokenRef.current += 1;
      const token = analysisTokenRef.current;
      setToc(null);
      setSearchIndex(null);
      setHighlight(null);
      setIndexRange(null);
      setRangeError(null);
      setAnalysis({ phase: 'idle' });

      if (result.doc.numPages > INDEX_PAGE_LIMIT) {
        setIndexRange({ from: '1', to: String(INDEX_PAGE_LIMIT) });
        void loadOutlineToc(result.doc, token);
      } else {
        void runExtraction(result.doc, 1, result.doc.numPages, hash);
      }

      if (resumePage > 1) {
        setTimeout(() => {
          scrollToPage(resumePage);
          setPageNumber(resumePage);
          restoringRef.current = null;
        }, 0);
      }
    },
    [loadOutlineToc, runExtraction, scrollToPage],
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

  const ensureAskConsent = ai.ensureConsent;
  const semantic = useSemanticIndex({
    docId,
    pages: extractedPages,
    settings: aiSettings,
    apiKey: aiKey,
  });
  const ask = useAsk({
    docId,
    pages: extractedPages,
    index: searchIndex,
    semantic,
    settings: aiSettings,
    apiKey: aiKey,
    ensureConsent: ensureAskConsent,
  });
  const flashcards = useFlashcards({
    docId,
    summaries: summarize.records,
    section: currentSection,
    pages: extractedPages,
    settings: aiSettings,
    apiKey: aiKey,
    ensureConsent: ensureAskConsent,
  });
  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  /** Đóng tài liệu đang mở và xoá trạng thái phân tích trong bộ nhớ. */
  const resetDocument = useCallback(async () => {
    analysisTokenRef.current += 1;
    await closeRef.current?.();
    closeRef.current = null;
    docRef.current = null;
    restoringRef.current = null;
    setDoc(null);
    setDocId(null);
    setFileName('');
    setStatus('empty');
    setToc(null);
    setSearchIndex(null);
    setAnalysis({ phase: 'idle' });
    setPageWords({});
    setHighlight(null);
    setIndexRange(null);
    setRangeError(null);
    summarize.forget();
    setExtractedPages([]);
    ocr.forget();
    resetBackgroundRuns();
  }, [resetBackgroundRuns]);

  const handleDeleteDocument = useCallback(async () => {
    if (docId === null) return;
    if (!window.confirm(vi.deleteDocumentConfirm(fileName))) return;

    const ok = await deleteDocumentData(docId);
    if (!ok) {
      setToast(vi.deleteFailed);
      return;
    }

    // Dừng lượt trích đang chạy và bỏ chỉ mục của tài liệu vừa xoá.
    analysisTokenRef.current += 1;
    setDocId(null);
    setToc(null);
    setSearchIndex(null);
    setAnalysis({ phase: 'idle' });
    setPageWords({});
    summarize.forget();
    setExtractedPages([]);
    ocr.forget();
    resetBackgroundRuns();
    setToast(vi.deleteDocumentDone);
  }, [docId, fileName, resetBackgroundRuns]);

  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm(vi.deleteAllConfirm)) return;

    const ok = await clearAllData();
    if (!ok) {
      setToast(vi.deleteFailed);
      return;
    }

    await resetDocument();
    stats.reset();
    setToast(vi.deleteAllDone);
  }, [resetDocument]);

  const stats = useReadingStats({
    ready: status === 'ready',
    pageNumber,
    pageWords,
    setSpeed,
  });
  const chapterMinutes = chapterEstimate(toc, pageNumber, readingWordsPerMinute);
  const {
    timer,
    remainingMs: remainingTimerMs,
    focusMinutes,
    breakMinutes,
    bandHeight,
    bandTop,
    focusMode,
    fullscreen,
    setFocusMinutes,
    setBreakMinutes,
    setBandHeight,
    startChapterTimer,
    startPomodoroTimer,
    toggleTimer,
    stopTimer: stopCurrentTimer,
    toggleFocusMode,
    toggleFullscreen,
    moveBand,
  } = useFocusTimer({ showToast: setToast, chapterMinutes });
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

  const handleOpenSearch = useCallback(() => {
    setSidebarOpen(true);
    setSearchRequest((value) => value + 1);
  }, []);
  const handleToggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  useShortcuts({
    ready: status === 'ready',
    docRef,
    pageNumberRef,
    focusMode,
    goToPage,
    toggleFocusMode,
    toggleTimer,
    moveBand,
    onOpenSearch: handleOpenSearch,
    onToggleSidebar: handleToggleSidebar,
  });

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

  const startIndexing = () => {
    if (!doc || !indexRange) return;

    const from = Number.parseInt(indexRange.from, 10);
    const to = Number.parseInt(indexRange.to, 10);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to < from ||
      to > doc.numPages
    ) {
      setRangeError(vi.indexRangeInvalid);
      return;
    }
    if (to - from + 1 > INDEX_PAGE_LIMIT) {
      setRangeError(vi.indexRangeTooLong(INDEX_PAGE_LIMIT));
      return;
    }

    setIndexRange(null);
    void runExtraction(doc, from, to, docId);
  };

  const totalPages = doc?.numPages ?? 0;
  // Có trang chưa có lớp chữ (bản scan) hoặc đã từng OCR thì cho nhận dạng chữ.
  const showOcrPanel =
    status === 'ready' &&
    analysis.phase === 'done' &&
    (analysis.profile.isScanned ||
      ocrPages.size > 0 ||
      extractedPages.some((page) => page.text.trim() === ''));
  const fallbackSize = pageSizes[1] ?? FALLBACK_PAGE_SIZE;
  const showNotice =
    status === 'ready' &&
    (indexRange !== null ||
      analysis.phase === 'extracting' ||
      analysis.phase === 'error' ||
      (analysis.phase === 'done' && analysis.profile.isScanned) ||
      showOcrPanel ||
      ocrProgress !== null);

  return (
    <div
      class="app"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer?.files[0];
        if (file) void handleFile(file);
      }}
    >
      <header class="toolbar" role="group" aria-label="Điều khiển tài liệu">
        <button
          type="button"
          class="toolbar__button toolbar__button--primary"
          onClick={() => inputRef.current?.click()}
        >
          {vi.openFile}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void handleFile(file);
            event.currentTarget.value = '';
          }}
        />

        <span class="toolbar__name" title={fileName}>
          {fileName || vi.fileNameUnknown}
        </span>

        {status === 'ready' && analysis.phase === 'done' && (
          <span class="toolbar__profile">{profileLabel(analysis.profile.kind)}</span>
        )}

        {timer.status !== 'idle' && (
          <button
            type="button"
            class={`toolbar__button toolbar__timer${
              timer.status === 'paused' ? ' toolbar__timer--paused' : ''
            }`}
            aria-label={vi.timerToggleAria(
              timerModeLabel(timer.mode),
              formatTimer(remainingTimerMs),
            )}
            onClick={toggleTimer}
          >
            <span class="toolbar__timer-mode">{timerModeLabel(timer.mode)}</span>
            <span class="toolbar__timer-time">{formatTimer(remainingTimerMs)}</span>
          </button>
        )}

        <div class="toolbar__group">
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.previousPage}
            disabled={status !== 'ready' || pageNumber <= 1}
            onClick={() => goToPage(pageNumberRef.current - 1)}
          >
            ←
          </button>
          <input
            class="toolbar__page"
            type="number"
            min={1}
            max={totalPages}
            aria-label={vi.pageInputLabel}
            value={pageDraft}
            disabled={status !== 'ready'}
            onInput={(event) => setPageDraft(event.currentTarget.value)}
            onBlur={commitPageDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitPageDraft();
            }}
          />
          <span class="toolbar__total">{vi.pageLabel(pageNumber, Math.max(totalPages, 1))}</span>
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.nextPage}
            disabled={status !== 'ready' || pageNumber >= totalPages}
            onClick={() => goToPage(pageNumberRef.current + 1)}
          >
            →
          </button>
        </div>

        <div class="toolbar__group">
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.zoomOut}
            disabled={status !== 'ready'}
            onClick={() => handleZoom(-1)}
          >
            −
          </button>
          <span class="toolbar__zoom">{vi.zoomLabel(Math.round(scale * 100))}</span>
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.zoomIn}
            disabled={status !== 'ready'}
            onClick={() => handleZoom(1)}
          >
            +
          </button>
          <button
            type="button"
            class="toolbar__button"
            disabled={status !== 'ready'}
            onClick={handleFitWidth}
          >
            {vi.zoomFitWidth}
          </button>
        </div>

        <button
          type="button"
          class="toolbar__button"
          aria-label={vi.tocTitle}
          aria-expanded={sidebarOpen}
          aria-controls="viewer-sidebar"
          disabled={status !== 'ready'}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {vi.tocTitle}
        </button>
      </header>

      {showNotice && (
        <section class="notice" aria-live="polite">
          {indexRange && (
            <form
              class="notice__form"
              onSubmit={(event) => {
                event.preventDefault();
                startIndexing();
              }}
            >
              <p class="notice__text">{vi.longDocWarning(INDEX_PAGE_LIMIT)}</p>
              <label class="notice__field">
                {vi.indexFrom}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={indexRange.from}
                  onInput={(event) =>
                    setIndexRange({ ...indexRange, from: event.currentTarget.value })
                  }
                />
              </label>
              <label class="notice__field">
                {vi.indexTo}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={indexRange.to}
                  onInput={(event) =>
                    setIndexRange({ ...indexRange, to: event.currentTarget.value })
                  }
                />
              </label>
              <button type="submit" class="notice__button">
                {vi.indexStart}
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
              <span>{vi.extracting(analysis.done, analysis.total)}</span>
            </div>
          )}

          {analysis.phase === 'done' && analysis.profile.isScanned && (
            <p class="notice__text notice__text--warning">{vi.scannedWarning}</p>
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
              {vi.extractFailed}
            </p>
          )}
        </section>
      )}

      <div class="workspace">
        <main class={`content${status === 'ready' ? ' content--document' : ''}`} ref={contentRef}>
          {status === 'empty' && (
            <div class="empty">
              <h1>{vi.appName}</h1>
              <p class="empty__title">{vi.emptyTitle}</p>
              <p class="empty__hint">{vi.emptyHint}</p>
              <button type="button" class="empty__action" onClick={() => inputRef.current?.click()}>
                {vi.chooseFile}
              </button>
              <p class="empty__drop">{vi.dropHint}</p>
            </div>
          )}

          {status === 'opening' && <p class="status">{vi.loading}</p>}

          {status === 'error' && (
            <div class="empty" role="alert">
              <h1>{vi.errorTitle}</h1>
              <p class="empty__hint">{errorMessage(error)}</p>
              <button type="button" class="empty__action" onClick={() => inputRef.current?.click()}>
                {vi.retry}
              </button>
            </div>
          )}

          {status === 'ready' && doc && (
            <PageList
              doc={doc}
              scale={scale}
              sizes={pageSizes}
              fallbackSize={fallbackSize}
              highlight={highlight}
              ocrPages={ocrPages}
              scrollerRef={contentRef}
              onMeasured={handleMeasured}
              onCurrentPageChange={handleCurrentPageChange}
              onRenderError={handleRenderError}
            />
          )}
        </main>

        {status === 'ready' && sidebarOpen && !focusMode && (
          <Sidebar
            toc={toc}
            currentPage={pageNumber}
            building={analysis.phase === 'extracting'}
            index={searchIndex}
            wordsPerMinute={readingWordsPerMinute}
            focus={{
              timer,
              remainingMs: remainingTimerMs,
              chapterMinutes,
              focusMinutes,
              breakMinutes,
              bandHeight,
              fullscreen,
              statsToday: stats.today,
              statsRecent: stats.recent,
              onStartChapter: startChapterTimer,
              onStartPomodoro: startPomodoroTimer,
              onToggleTimer: toggleTimer,
              onStopTimer: stopCurrentTimer,
              onChangeFocusMinutes: (value) => setFocusMinutes(clampMinutes(value)),
              onChangeBreakMinutes: (value) => setBreakMinutes(clampMinutes(value, 1, 60)),
              onChangeBandHeight: (value) => setBandHeight(clampBandHeight(value)),
              onToggleFocusMode: toggleFocusMode,
              onToggleFullscreen: toggleFullscreen,
            }}
            settings={{
              theme: settings.theme,
              onChangeTheme: settings.onChangeTheme,
              ai: ai.panel,
              wordsPerMinute: readingWordsPerMinute,
              onChangeWordsPerMinute: settings.onChangeWordsPerMinute,
              autoOpenPdf: settings.autoOpenPdf,
              autoOpenSupported: settings.autoOpenSupported,
              onToggleAutoOpen: settings.onToggleAutoOpen,
              documentName: status === 'ready' && docId !== null ? fileName : null,
              onDeleteDocument: () => void handleDeleteDocument(),
              onDeleteAll: () => void handleDeleteAll(),
            }}
            summary={summarize.panel}
            semantic={semantic}
            flashPanel={{
              flashcards,
              hasDocument: docId !== null,
              documentName: fileName,
              canGenerate: currentSection !== null,
              aiConfigured: aiSupported && aiConfigProblem(aiSettings, aiKey) === null,
              sectionLabel: currentSection
                ? currentSection.title ||
                  vi.summarySectionRange(currentSection.startPage, currentSection.endPage)
                : null,
              onOpenSettings: () => {},
              onSelectPage: goToPage,
            }}
            askPanel={{
              ask,
              hasDocument: docId !== null,
              hasText: extractedPages.some((page) => page.text.trim() !== ''),
              configured: ai.configured,
              semanticReady: semantic.state === 'ready',
              providerId: aiSettings.providerId,
              onOpenSettings: () => {},
              onSelectCitation: handleCitation,
            }}
            summarizedSpans={summarize.summarizedSpans}
            searchRequest={searchRequest}
            onSelectPage={goToPage}
            onSelectResult={handleSearchResult}
          />
        )}
      </div>

      {focusMode && (
        <>
          <div
            class="focus-band"
            style={{ top: `${bandTop}px`, height: `${bandHeight}px` }}
            aria-hidden="true"
          />
          <div class="focus-controls" role="group" aria-label={vi.focusModeTitle}>
            {timer.status !== 'idle' && (
              <span class="focus-controls__timer">
                {timerModeLabel(timer.mode)} · {formatTimer(remainingTimerMs)}
              </span>
            )}
            <button type="button" class="focus-button" onClick={toggleFullscreen}>
              {fullscreen ? vi.focusExitFullscreen : vi.focusFullscreen}
            </button>
            <button
              type="button"
              class="focus-button focus-button--primary"
              onClick={toggleFocusMode}
            >
              {vi.focusModeOff}
            </button>
          </div>
          <p class="focus-move-hint">{vi.focusMoveHint}</p>
        </>
      )}

      {toast !== null && (
        <div class="toast" role="status">
          <span>{toast}</span>
          <button
            type="button"
            class="toast__close"
            aria-label={vi.toastDismiss}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {ai.consentOpen && (
        <Dialog titleId="ai-consent-title" onClose={ai.cancelConsent}>
          <h2 class="consent-dialog__title" id="ai-consent-title">
            {vi.aiConsentTitle}
          </h2>
          <p class="consent-dialog__body">
            {vi.aiConsentBody(vi.aiProviders[aiSettings.providerId])}
          </p>
          <div class="consent-dialog__actions">
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={ai.acceptConsent}
            >
              {vi.aiConsentAccept}
            </button>
            <button type="button" class="settings-button" onClick={ai.cancelConsent}>
              {vi.aiConsentCancel}
            </button>
          </div>
        </Dialog>
      )}

      {isDragging && <div class="drop-overlay">{vi.dropActive}</div>}
    </div>
  );
}
