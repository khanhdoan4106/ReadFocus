import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type PageRange } from '../core/ocr/pages';
import { chapterEstimate } from '../core/reading-time';
import { t } from '../i18n';
import { PageList } from './PageList';
import { useAsk } from './ask';
import { useFlashcards } from './flashcards';
import { useSemanticIndex } from './semantic';
import { useDocument, type DocumentLifecycle } from './hooks/useDocument';
import { useAiSettings } from './hooks/useAiSettings';
import { useExtraction } from './hooks/useExtraction';
import { useFocusTimer } from './hooks/useFocusTimer';
import { useReadingStats } from './hooks/useReadingStats';
import { useOcr } from './hooks/useOcr';
import { useRunScope } from './hooks/useRunScope';
import { useSettings } from './hooks/useSettings';
import { useSummaries } from './hooks/useSummaries';
import { useShortcuts } from './hooks/useShortcuts';
import { ConsentDialog, FocusOverlay, Toast } from './Overlays';
import { NoticeBar } from './NoticeBar';
import { Toolbar } from './Toolbar';
import { ViewerSidebar } from './ViewerSidebar';

import { errorMessage } from './labels';

/** Giá trị ban đầu trước khi App gắn các hàm thật; không bao giờ được gọi. */
const NO_LIFECYCLE: DocumentLifecycle = {
  stopBackground: () => {},
  restoreOcr: async () => {},
  restartClock: () => {},
  openSummaries: () => {},
  beginAnalysis: () => {},
  invalidateAnalysis: () => {},
  clearAnalysis: () => {},
  clearRange: () => {},
  forgetSummaries: () => {},
  forgetOcr: () => {},
  resetStats: () => {},
};

export function App() {
  const lifecycle = useRef<DocumentLifecycle>(NO_LIFECYCLE);
  const [toast, setToast] = useState<string | null>(null);
  const {
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
    fallbackSize,
    totalPages,
  } = useDocument({ lifecycle, showToast: setToast });
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const settings = useSettings({ showToast: setToast });
  const readingWordsPerMinute = settings.wordsPerMinute;
  const setSpeed = settings.setSpeed;
  const ai = useAiSettings();
  const aiSettings = ai.settings;
  const aiKey = ai.apiKey;
  const [searchRequest, setSearchRequest] = useState(0);

  // Văn bản OCR đã lưu, dùng thay cho lớp chữ trống khi lập chỉ mục.
  const ocrTextRef = useRef<Map<number, string>>(new Map());
  // Khoảng trang đã lập chỉ mục gần nhất, để lập lại sau OCR.
  const indexedRangeRef = useRef<PageRange | null>(null);

  const extraction = useExtraction({ ocrTextRef, indexedRangeRef });
  const { analysis, toc, searchIndex, pageWords, extractedPages } = extraction;
  const runExtraction = extraction.runExtraction;
  const stats = useReadingStats({
    ready: status === 'ready',
    pageNumber,
    pageWords,
    setSpeed,
  });

  const scope = useRunScope();
  const ocr = useOcr({ docRef, docId, scope, ocrTextRef, indexedRangeRef, runExtraction });
  const ocrPages = ocr.pages;
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

  lifecycle.current = {
    stopBackground: resetBackgroundRuns,
    restoreOcr: ocr.load,
    restartClock: stats.restartClock,
    openSummaries: summarize.load,
    beginAnalysis: extraction.begin,
    invalidateAnalysis: extraction.invalidate,
    clearAnalysis: extraction.clear,
    clearRange: extraction.clearRange,
    forgetSummaries: summarize.forget,
    forgetOcr: ocr.forget,
    resetStats: stats.reset,
  };

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

  const chapterMinutes = chapterEstimate(toc, pageNumber, readingWordsPerMinute);
  const focus = useFocusTimer({ showToast: setToast, chapterMinutes });
  const {
    timer,
    remainingMs: remainingTimerMs,
    bandHeight,
    bandTop,
    focusMode,
    fullscreen,
    toggleTimer,
    toggleFocusMode,
    toggleFullscreen,
    moveBand,
  } = focus;
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
      <Toolbar
        ready={status === 'ready'}
        fileName={fileName}
        profileKind={status === 'ready' && analysis.phase === 'done' ? analysis.profile.kind : null}
        timer={timer}
        remainingMs={remainingTimerMs}
        pageNumber={pageNumber}
        pageDraft={pageDraft}
        totalPages={totalPages}
        scale={scale}
        sidebarOpen={sidebarOpen}
        inputRef={inputRef}
        onOpenFile={(file) => void handleFile(file)}
        onPrevious={() => goToPage(pageNumberRef.current - 1)}
        onNext={() => goToPage(pageNumberRef.current + 1)}
        onChangePageDraft={setPageDraft}
        onCommitPageDraft={commitPageDraft}
        onZoom={handleZoom}
        onFitWidth={handleFitWidth}
        onToggleTimer={toggleTimer}
        onToggleSidebar={handleToggleSidebar}
      />

      <NoticeBar
        ready={status === 'ready'}
        pageNumber={pageNumber}
        totalPages={totalPages}
        extraction={extraction}
        ocr={ocr}
        onStartIndexing={() => extraction.startIndexing(doc, docId)}
      />

      <div class="workspace">
        <main class={`content${status === 'ready' ? ' content--document' : ''}`} ref={contentRef}>
          {status === 'empty' && (
            <div class="empty">
              <h1>{t.appName}</h1>
              <p class="empty__title">{t.emptyTitle}</p>
              <p class="empty__hint">{t.emptyHint}</p>
              <button type="button" class="empty__action" onClick={() => inputRef.current?.click()}>
                {t.chooseFile}
              </button>
              <p class="empty__drop">{t.dropHint}</p>
            </div>
          )}

          {status === 'opening' && <p class="status">{t.loading}</p>}

          {status === 'error' && (
            <div class="empty" role="alert">
              <h1>{t.errorTitle}</h1>
              <p class="empty__hint">{errorMessage(error)}</p>
              <button type="button" class="empty__action" onClick={() => inputRef.current?.click()}>
                {t.retry}
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
          <ViewerSidebar
            ready
            pageNumber={pageNumber}
            docId={docId}
            fileName={fileName}
            wordsPerMinute={readingWordsPerMinute}
            chapterMinutes={chapterMinutes}
            currentSection={currentSection}
            searchRequest={searchRequest}
            extraction={extraction}
            focus={focus}
            stats={stats}
            settings={settings}
            ai={ai}
            summarize={summarize}
            semantic={semantic}
            flashcards={flashcards}
            ask={ask}
            onDeleteDocument={() => void handleDeleteDocument()}
            onDeleteAll={() => void handleDeleteAll()}
            onSelectPage={goToPage}
            onSelectCitation={handleCitation}
            onSelectResult={handleSearchResult}
          />
        )}
      </div>

      {focusMode && (
        <FocusOverlay
          bandTop={bandTop}
          bandHeight={bandHeight}
          timer={timer}
          remainingMs={remainingTimerMs}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          onExit={toggleFocusMode}
        />
      )}

      {toast !== null && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {ai.consentOpen && (
        <ConsentDialog
          providerId={aiSettings.providerId}
          onAccept={ai.acceptConsent}
          onCancel={ai.cancelConsent}
        />
      )}

      {isDragging && <div class="drop-overlay">{t.dropActive}</div>}
    </div>
  );
}
