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
import type { Annotation, Rect } from '../core/annotate/types';
import { useAnnotations } from './hooks/useAnnotations';
import { useAnnotationUi } from './hooks/useAnnotationUi';
import { useLocalModel } from './hooks/useLocalModel';
import { useProgressSync } from './hooks/useProgressSync';
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
import { AnnotationOverlays } from './AnnotationOverlays';
import { SyncNoticeBar } from './SyncNoticeBar';
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
    openedProgress,
    fallbackSize,
    totalPages,
  } = useDocument({ lifecycle, showToast: setToast });
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const settings = useSettings({ showToast: setToast });
  const readingWordsPerMinute = settings.wordsPerMinute;
  const setSpeed = settings.setSpeed;
  const ai = useAiSettings();
  const localModel = useLocalModel();
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
    localModelReady: localModel.state === 'ready',
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
  const progressSync = useProgressSync({
    docId,
    pageNumber,
    totalPages,
    ready: status === 'ready',
    openedProgress,
    goToPage,
  });
  const annotations = useAnnotations({ docId, pages: extractedPages });
  const [flashId, setFlashId] = useState<string | null>(null);
  const annotationUi = useAnnotationUi({
    api: annotations,
    pages: extractedPages,
    getCurrentPage: () => pageNumberRef.current,
    ready: status === 'ready',
    showToast: setToast,
  });
  // Trang nào cũng nhận danh sách chú thích của riêng nó; highlight chữ mồ côi không được vẽ.
  const annotationsByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const item of annotations.items) {
      // Chỉ vẽ highlight đã có rect đúng: `orphan` không có chỗ, `moved` chờ tính lại rect từ text layer.
      if (annotations.statuses.get(item.id) !== 'ok') continue;
      map.set(item.page, [...(map.get(item.page) ?? []), item]);
    }
    return map;
  }, [annotations.items, annotations.statuses]);
  const handleJumpNote = useCallback(
    (annotation: Annotation) => {
      goToPage(annotation.page);
      setFlashId(annotation.id);
      setTimeout(() => setFlashId((current) => (current === annotation.id ? null : current)), 1800);
    },
    [goToPage],
  );
  const reflowByPage = useMemo(() => {
    const map = new Map<number, Array<{ id: string; start: number; end: number }>>();
    for (const item of annotations.moved) {
      map.set(item.page, [...(map.get(item.page) ?? []), item]);
    }
    return map;
  }, [annotations.moved]);
  // Highlight `moved` mà text layer đã dựng nhưng ánh xạ vẫn thất bại: tab Ghi chú cho gắn lại.
  const [reflowFailed, setReflowFailed] = useState<ReadonlySet<string>>(() => new Set());
  const handleReflowFailed = useCallback((id: string) => {
    setReflowFailed((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);
  const stuckAnnotations = useMemo(
    () => new Set(annotations.moved.filter((m) => reflowFailed.has(m.id)).map((m) => m.id)),
    [annotations.moved, reflowFailed],
  );
  useEffect(() => setReflowFailed(new Set()), [docId]);
  const annotationItems = annotations.items;
  const changeAnnotation = annotations.change;
  const handleReflow = useCallback(
    (id: string, start: number, end: number, rects: Rect[]) => {
      const target = annotationItems.find((item) => item.id === id);
      if (!target || target.anchor.type !== 'text') return;
      // Giữ nguyên quote/prefix/suffix; chỉ đổi vị trí và rect (updatedAt tăng theo).
      changeAnnotation(id, { anchor: { ...target.anchor, start, end, rects } });
    },
    [annotationItems, changeAnnotation],
  );
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
    onHighlight: () => annotationUi.highlightSelection(annotationUi.color, false),
    onPageNote: annotationUi.addPageNote,
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
        areaMode={annotationUi.areaMode}
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
        onToggleAreaMode={annotationUi.toggleAreaMode}
      />

      <SyncNoticeBar sync={progressSync} />

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
              annotations={annotationsByPage}
              areaMode={annotationUi.areaMode}
              flashId={flashId}
              pageTexts={annotations.textByPage}
              reflow={reflowByPage}
              onReflow={handleReflow}
              onReflowFailed={handleReflowFailed}
              onDrawArea={annotationUi.addAreaNote}
              onOpenAnnotation={annotationUi.openPopover}
              scrollerRef={contentRef}
              onMeasured={handleMeasured}
              onCurrentPageChange={handleCurrentPageChange}
              onRenderError={handleRenderError}
            />
          )}
        </main>

        {status === 'ready' && sidebarOpen && !focusMode && (
          <ViewerSidebar
            localModel={localModel}
            annotations={annotations}
            annotationUi={annotationUi}
            progressSync={progressSync}
            stuckAnnotations={stuckAnnotations}
            showToast={setToast}
            onJumpNote={handleJumpNote}
            ready
            pageNumber={pageNumber}
            totalPages={totalPages}
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
            onDeleteAll={(includeNotes) => void handleDeleteAll(includeNotes)}
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

      <AnnotationOverlays ui={annotationUi} api={annotations} />

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
