import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { clampPage, fitWidthScale, stepZoom } from '../core/pagination';
import { vi } from '../i18n/vi';
import { MAX_FILE_BYTES, openPdfFile } from './pdf';
import { PdfPage } from './PdfPage';

type Status = 'empty' | 'opening' | 'ready' | 'error';
type ErrorReason = 'not-pdf' | 'too-large' | 'password' | 'invalid' | 'unknown' | 'render';

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
  const [fileName, setFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageDraft, setPageDraft] = useState('1');
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const closeRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    return () => {
      void closeRef.current?.();
      closeRef.current = null;
      docRef.current = null;
    };
  }, []);

  useEffect(() => {
    setPageDraft(String(pageNumber));
  }, [pageNumber]);

  const handleFile = useCallback(async (file: File) => {
    setStatus('opening');
    const result = await openPdfFile(file);

    if (!result.ok) {
      setError(result.reason);
      setStatus('error');
      return;
    }

    await closeRef.current?.();
    docRef.current = result.doc;
    closeRef.current = result.close;

    const firstPage = await result.doc.getPage(1);
    const pageWidth = firstPage.getViewport({ scale: 1 }).width;
    const availableWidth = (contentRef.current?.clientWidth ?? 0) - 48;

    setDoc(result.doc);
    setFileName(file.name);
    setPageNumber(1);
    setPageDraft('1');
    setScale(availableWidth > 0 ? fitWidthScale(pageWidth, availableWidth) : 1);
    setStatus('ready');
  }, []);

  const goToPage = useCallback((next: number) => {
    setPageNumber(clampPage(next, docRef.current?.numPages ?? 1));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (docRef.current === null || status !== 'ready') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToPage(pageNumber + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPage(pageNumber - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPage, pageNumber, status]);

  const handleZoom = (direction: 1 | -1) => setScale((current) => stepZoom(current, direction));

  const handleFitWidth = () => {
    if (!doc) return;
    void doc.getPage(pageNumber).then((page) => {
      const pageWidth = page.getViewport({ scale: 1 }).width;
      const availableWidth = (contentRef.current?.clientWidth ?? 0) - 48;
      if (availableWidth > 0) setScale(fitWidthScale(pageWidth, availableWidth));
    });
  };

  const commitPageDraft = () => {
    const parsed = Number.parseInt(pageDraft, 10);
    if (Number.isNaN(parsed)) {
      setPageDraft(String(pageNumber));
      return;
    }
    goToPage(parsed);
  };

  const handleRenderError = useCallback(() => {
    setError('render');
    setStatus('error');
  }, []);

  const totalPages = doc?.numPages ?? 0;

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

        <div class="toolbar__group">
          <button
            type="button"
            class="toolbar__button"
            aria-label={vi.previousPage}
            disabled={status !== 'ready' || pageNumber <= 1}
            onClick={() => goToPage(pageNumber - 1)}
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
            onClick={() => goToPage(pageNumber + 1)}
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
      </header>

      <main class="content" ref={contentRef}>
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
          <PdfPage
            doc={doc}
            pageNumber={pageNumber}
            scale={scale}
            onRenderError={handleRenderError}
          />
        )}
      </main>

      {isDragging && <div class="drop-overlay">{vi.dropActive}</div>}
    </div>
  );
}
