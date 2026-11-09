import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { sha256Hex } from '../core/hash';
import { clampPage, fitWidthScale, stepZoom } from '../core/pagination';
import { buildProfile, type DocKind, type DocumentProfile, type PageSample } from '../core/profile';
import { acceptPageReport, canPersistProgress } from '../core/progress';
import {
  addReadingSample,
  emptyReadingSpeed,
  estimateItemMinutes,
  MAX_ACTIVE_GAP_MS,
  roundedMinutes,
  sanitizeReadingSpeed,
  wordsPerMinute as learnedWordsPerMinute,
  type ReadingSpeed,
} from '../core/reading-time';
import { buildSearchIndex, type SearchIndex } from '../core/search';
import { countWords } from '../core/text';
import { buildToc, type TocPage, type TocResult } from '../core/toc';
import {
  clampBandHeight,
  clampMinutes,
  DEFAULT_BAND_HEIGHT,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  formatTimer,
  nextPomodoroPhase,
  pauseTimer,
  resumeTimer,
  shouldAutoPause,
  startTimer,
  stopTimer,
  tickTimer,
  timerRemaining,
  type FocusTimer,
  type TimerMode,
} from '../core/focus';
import { emptyDayStats, type DayStats } from '../core/stats';
import { vi } from '../i18n/vi';
import {
  addDailyReading,
  clearPageTexts,
  loadDayStats,
  loadProgress,
  loadRecentStats,
  loadSetting,
  recordDocumentOpen,
  savePageTexts,
  saveProgress,
  saveSetting,
} from '../storage/db';
import { extractRange, INDEX_PAGE_LIMIT, readOutline } from './extract';
import { PageList, type PageSize } from './PageList';
import { MAX_FILE_BYTES, openPdfData, readPdfFile } from './pdf';
import { Sidebar } from './Sidebar';

type Status = 'empty' | 'opening' | 'ready' | 'error';
type ErrorReason = 'not-pdf' | 'too-large' | 'password' | 'invalid' | 'unknown' | 'render';

type Analysis =
  | { phase: 'idle' }
  | { phase: 'extracting'; done: number; total: number }
  | { phase: 'done'; profile: DocumentProfile }
  | { phase: 'error' };

type IndexRange = {
  from: string;
  to: string;
};

const FALLBACK_PAGE_SIZE: PageSize = { width: 612, height: 792 };

function profileLabel(kind: DocKind): string {
  switch (kind) {
    case 'book':
      return vi.profileBook;
    case 'paper':
      return vi.profilePaper;
    case 'slides':
      return vi.profileSlides;
    case 'unknown':
      return vi.profileUnknown;
  }
}

function timerModeLabel(mode: FocusTimer['mode']): string {
  switch (mode) {
    case 'chapter':
      return vi.timerModeChapter;
    case 'focus':
      return vi.timerModeFocus;
    case 'break':
      return vi.timerModeBreak;
  }
}

const IDLE_TIMER: FocusTimer = {
  mode: 'chapter',
  status: 'idle',
  durationMs: 0,
  remainingMs: 0,
  startedAt: null,
};

/** Ước tính số phút của mục đang đọc; 0 khi chưa có mục lục hoặc chưa học được tốc độ. */
function chapterEstimate(toc: TocResult | null, page: number, wordsPerMinute: number): number {
  if (toc === null || wordsPerMinute <= 0) return 0;
  const item = toc.items.find((entry) => page >= entry.startPage && page <= entry.endPage);
  if (item === undefined) return 0;
  return Math.max(roundedMinutes(estimateItemMinutes(item, wordsPerMinute)), 1);
}

async function hashData(data: ArrayBuffer): Promise<string | null> {
  try {
    return await sha256Hex(data);
  } catch {
    // Không băm được vẫn phải cho đọc, chỉ là không lưu/khôi phục tiến độ.
    return null;
  }
}

function errorMessage(reason: ErrorReason): string {
  switch (reason) {
    case 'not-pdf':
      return vi.errorNotPdf;
    case 'too-large':
      return vi.errorTooLarge(Math.round(MAX_FILE_BYTES / (1024 * 1024)));
    case 'password':
      return vi.errorPassword;
    case 'invalid':
    case 'render':
      return vi.errorInvalid;
    case 'unknown':
      return vi.errorGeneric;
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
  const [speed, setSpeed] = useState<ReadingSpeed>(emptyReadingSpeed);
  const [highlight, setHighlight] = useState<{
    page: number;
    query: string;
    ignoreDiacritics: boolean;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timer, setTimer] = useState<FocusTimer>(IDLE_TIMER);
  const [now, setNow] = useState(() => Date.now());
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [bandHeight, setBandHeight] = useState(DEFAULT_BAND_HEIGHT);
  const [bandTop, setBandTop] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [todayStats, setTodayStats] = useState<DayStats>(() => emptyDayStats());
  const [recentStats, setRecentStats] = useState<DayStats[]>([]);
  const [toast, setToast] = useState<string | null>(null);

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
  // Đồng hồ đọc: thời gian đang đọc trang hiện tại, chỉ cộng khi tab hiển thị.
  const clockRef = useRef<{ page: number; activeMs: number; lastTick: number | null }>({
    page: 1,
    activeMs: 0,
    lastTick: null,
  });
  const speedReadyRef = useRef(false);
  const settingsReadyRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  // Số phút/trang đã đọc chờ ghi vào thống kê ngày.
  const statsPendingRef = useRef({ minutes: 0, pages: 0 });
  const bandHeightRef = useRef(bandHeight);
  bandHeightRef.current = bandHeight;

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
          onPage: (page) => {
            samples.push(page);
            tocPages.push({
              page: page.page,
              text: page.text,
              lines: page.lines,
              width: page.width,
              height: page.height,
            });
            pending.push({ page: page.page, text: page.text });
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

  const handleSearchResult = useCallback(
    (page: number, query: string, ignoreDiacritics: boolean) => {
      goToPage(page);
      setHighlight({ page, query, ignoreDiacritics });
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

      await closeRef.current?.();
      docRef.current = result.doc;
      closeRef.current = result.close;

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
      clockRef.current = {
        page: resumePage,
        activeMs: 0,
        lastTick: document.visibilityState === 'visible' ? Date.now() : null,
      };
      setPageWords({});

      if (hash) {
        void recordDocumentOpen({
          id: hash,
          name: file.name,
          size: file.size,
          pageCount: result.doc.numPages,
        });
      }

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

  // Nạp tốc độ đọc đã học từ các phiên trước.
  useEffect(() => {
    void loadSetting<unknown>('readingSpeed').then((value) => {
      if (value !== null) setSpeed(sanitizeReadingSpeed(value));
      speedReadyRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!speedReadyRef.current) return;
    void saveSetting('readingSpeed', speed);
  }, [speed]);

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const refreshStats = useCallback(async () => {
    const [today, recent] = await Promise.all([loadDayStats(), loadRecentStats(7)]);
    setTodayStats(today);
    setRecentStats(recent);
  }, []);

  const flushStats = useCallback(async () => {
    const pending = statsPendingRef.current;
    if (pending.minutes < 0.01 && pending.pages === 0) return;
    statsPendingRef.current = { minutes: 0, pages: 0 };
    const today = await addDailyReading(pending.minutes, pending.pages);
    setTodayStats(today);
    setRecentStats(await loadRecentStats(7));
  }, []);

  const notify = useCallback((title: string, message: string) => {
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (chromeApi?.notifications) {
      try {
        void chromeApi.notifications.create({
          type: 'basic',
          iconUrl: chromeApi.runtime.getURL('icons/icon-128.png'),
          title,
          message,
        });
        return;
      } catch {
        // Chrome từ chối thông báo thì hiện ngay trong trang.
      }
    }
    setToast(`${title} — ${message}`);
  }, []);

  // Nạp thống kê ngày và thông số tập trung đã lưu.
  useEffect(() => {
    void refreshStats();
    void Promise.all([
      loadSetting<unknown>('focusMinutes'),
      loadSetting<unknown>('breakMinutes'),
      loadSetting<unknown>('focusBandHeight'),
    ]).then(([focusValue, breakValue, bandValue]) => {
      if (typeof focusValue === 'number') setFocusMinutes(clampMinutes(focusValue));
      if (typeof breakValue === 'number') setBreakMinutes(clampMinutes(breakValue, 1, 60));
      if (typeof bandValue === 'number') setBandHeight(clampBandHeight(bandValue));
      settingsReadyRef.current = true;
    });
  }, [refreshStats]);

  useEffect(() => {
    if (!settingsReadyRef.current) return;
    void saveSetting('focusMinutes', focusMinutes);
    void saveSetting('breakMinutes', breakMinutes);
    void saveSetting('focusBandHeight', bandHeight);
  }, [focusMinutes, breakMinutes, bandHeight]);

  // Ghi nhận hoạt động để tự tạm dừng khi người dùng rời đi.
  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      'pointermove',
      'pointerdown',
      'keydown',
      'wheel',
      'scroll',
      'touchstart',
    ];
    for (const event of events) window.addEventListener(event, markActive, { passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, markActive);
    };
  }, [markActive]);

  // Hẹn giờ chạy theo đồng hồ thật; tab bị ẩn hoặc người dùng ngồi im thì tạm dừng.
  useEffect(() => {
    if (timer.status !== 'running') return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (
        document.visibilityState !== 'visible' ||
        shouldAutoPause(lastActivityRef.current, current)
      ) {
        setTimer((value) => pauseTimer(value, current));
        return;
      }
      setTimer((value) => tickTimer(value, current));
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timer.status]);

  const handleTimerFinished = useCallback(
    (mode: TimerMode) => {
      switch (mode) {
        case 'chapter':
          notify(vi.notifyChapterTitle, vi.notifyChapterBody);
          break;
        case 'focus':
          notify(vi.notifyFocusTitle, vi.notifyFocusBody);
          break;
        case 'break':
          notify(vi.notifyBreakTitle, vi.notifyBreakBody);
          break;
      }
    },
    [notify],
  );

  useEffect(() => {
    if (timer.status !== 'finished') return;
    const mode = timer.mode;
    handleTimerFinished(mode);
    if (mode === 'focus' || mode === 'break') {
      const next = nextPomodoroPhase(timer, focusMinutes, breakMinutes, Date.now());
      if (next !== null) setTimer(next);
    }
  }, [timer, focusMinutes, breakMinutes, handleTimerFinished]);

  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Ghi thống kê định kỳ thay vì mỗi giây.
  useEffect(() => {
    if (status !== 'ready') return;
    const id = setInterval(() => void flushStats(), 30_000);
    return () => {
      clearInterval(id);
      void flushStats();
    };
  }, [status, flushStats]);

  // Dải sáng đi theo chuột khi bật chế độ tập trung.
  useEffect(() => {
    if (!focusMode) return;
    const onMove = (event: PointerEvent) => {
      const height = bandHeightRef.current;
      const top = event.clientY - height / 2;
      setBandTop(Math.min(Math.max(top, 0), Math.max(window.innerHeight - height, 0)));
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    setBandTop((top) => Math.min(Math.max(top, 0), Math.max(window.innerHeight - bandHeight, 0)));
  }, [bandHeight, focusMode]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Đồng hồ chỉ chạy khi tab hiển thị; khoảng nghỉ dài hơn 2 phút không được tính.
  useEffect(() => {
    if (status !== 'ready') return;
    const clock = clockRef.current;

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible') {
        clock.lastTick = null;
        return;
      }
      if (clock.lastTick === null) {
        clock.lastTick = now;
        return;
      }
      const delta = Math.min(Math.max(now - clock.lastTick, 0), MAX_ACTIVE_GAP_MS);
      clock.activeMs += delta;
      statsPendingRef.current.minutes += delta / 60_000;
      clock.lastTick = now;
    };

    const onVisibilityChange = () => {
      clock.lastTick = null;
      tick();
      if (document.visibilityState !== 'visible') void flushStats();
    };

    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    tick();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clock.lastTick = null;
    };
  }, [flushStats, status]);

  // Rời trang thì chốt mẫu đọc của trang vừa xem để học tốc độ thực tế.
  useEffect(() => {
    const clock = clockRef.current;
    if (clock.page === pageNumber) return;

    const words = pageWords[clock.page] ?? 0;
    if (words > 0 && clock.activeMs > 0) {
      setSpeed((current) => addReadingSample(current, { words, activeMs: clock.activeMs }));
    }
    if (clock.activeMs >= 1000) statsPendingRef.current.pages += 1;

    clock.page = pageNumber;
    clock.activeMs = 0;
    clock.lastTick = document.visibilityState === 'visible' ? Date.now() : null;
  }, [pageNumber, pageWords]);

  const readingWordsPerMinute = learnedWordsPerMinute(speed);
  const chapterMinutes = chapterEstimate(toc, pageNumber, readingWordsPerMinute);
  const remainingTimerMs = timerRemaining(timer, now);

  const startChapterTimer = useCallback(() => {
    if (chapterMinutes <= 0) return;
    markActive();
    const current = Date.now();
    setNow(current);
    setTimer(startTimer('chapter', chapterMinutes * 60_000, current));
  }, [chapterMinutes, markActive]);

  const startPomodoroTimer = useCallback(() => {
    markActive();
    const current = Date.now();
    setNow(current);
    setTimer(startTimer('focus', clampMinutes(focusMinutes) * 60_000, current));
  }, [focusMinutes, markActive]);

  const toggleTimer = useCallback(() => {
    markActive();
    const current = Date.now();
    setNow(current);
    setTimer((value) => {
      if (value.status === 'running') return pauseTimer(value, current);
      if (value.status === 'paused') return resumeTimer(value, current);
      return startTimer('focus', clampMinutes(focusMinutes) * 60_000, current);
    });
  }, [focusMinutes, markActive]);

  const stopCurrentTimer = useCallback(() => {
    setTimer((value) => stopTimer(value));
    setNow(Date.now());
  }, []);

  const toggleFocusMode = useCallback(() => {
    if (focusMode) {
      setFocusMode(false);
      if (document.fullscreenElement !== null) {
        void document.exitFullscreen().catch(() => undefined);
      }
      return;
    }
    markActive();
    setBandTop(Math.max((window.innerHeight - bandHeightRef.current) / 2, 0));
    setFocusMode(true);
  }, [focusMode, markActive]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (typeof document.documentElement.requestFullscreen !== 'function') {
      setToast(vi.focusFullscreenFailed);
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => {
      setToast(vi.focusFullscreenFailed);
    });
  }, []);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (docRef.current === null || status !== 'ready') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (focusMode) {
        if (event.key === 'Escape') {
          event.preventDefault();
          toggleFocusMode();
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const delta = event.key === 'ArrowUp' ? -32 : 32;
          setBandTop((top) =>
            Math.min(
              Math.max(top + delta, 0),
              Math.max(window.innerHeight - bandHeightRef.current, 0),
            ),
          );
          return;
        }
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFocusMode();
      } else if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      } else if (event.key === ' ') {
        event.preventDefault();
        toggleTimer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToPage(pageNumberRef.current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPage(pageNumberRef.current - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, goToPage, status, toggleFocusMode, toggleTimer]);

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
  const fallbackSize = pageSizes[1] ?? FALLBACK_PAGE_SIZE;
  const showNotice =
    status === 'ready' &&
    (indexRange !== null ||
      analysis.phase === 'extracting' ||
      analysis.phase === 'error' ||
      (analysis.phase === 'done' && analysis.profile.isScanned));

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
              statsToday: todayStats,
              statsRecent: recentStats,
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

      {isDragging && <div class="drop-overlay">{vi.dropActive}</div>}
    </div>
  );
}
