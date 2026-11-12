import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { ocrHighlightRects } from '../core/ocr/highlight';
import { isLowConfidence } from '../core/ocr/pages';
import type { OcrPageView } from '../core/ocr/types';
import { matchesQuery } from '../core/search';
import { vi } from '../i18n/vi';
import type { PageSize } from './PageList';

export type TextHighlight = {
  query: string;
  ignoreDiacritics: boolean;
};

type PdfPageProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  highlight?: TextHighlight | null;
  /** Trang có chữ do OCR nhận dạng: tô kết quả tìm kiếm bằng lớp phủ riêng và hiện nhãn. */
  ocr?: OcrPageView | null;
  onMeasured: (page: number, size: PageSize) => void;
  onRenderError: () => void;
};

function paintHighlight(container: HTMLElement, highlight: TextHighlight | null): void {
  for (const span of container.querySelectorAll<HTMLElement>('span')) {
    const matched =
      highlight !== null &&
      matchesQuery(span.textContent ?? '', highlight.query, highlight.ignoreDiacritics);
    span.classList.toggle('textLayer__match', matched);
  }
}

export function PdfPage({
  doc,
  pageNumber,
  scale,
  highlight,
  ocr,
  onMeasured,
  onRenderError,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const measuredRef = useRef(onMeasured);
  const errorHandlerRef = useRef(onRenderError);
  measuredRef.current = onMeasured;
  errorHandlerRef.current = onRenderError;

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;

    const pageElement = pageRef.current;
    const canvas = canvasRef.current;
    const textElement = textRef.current;
    if (!pageElement || !canvas || !textElement) return;

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        measuredRef.current(pageNumber, {
          width: baseViewport.width,
          height: baseViewport.height,
        });

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        pageElement.style.setProperty('--total-scale-factor', String(scale));
        pageElement.style.width = `${Math.floor(viewport.width)}px`;
        pageElement.style.height = `${Math.floor(viewport.height)}px`;

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);

        const context = canvas.getContext('2d');
        if (!context) return;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (cancelled) return;

        textElement.replaceChildren();
        textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textElement,
          viewport,
        });
        await textLayer.render();
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        if (!cancelled && name !== 'RenderingCancelledException') {
          errorHandlerRef.current();
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, scale]);

  // Text layer được dựng bất đồng bộ, nên vừa tô ngay vừa theo dõi thay đổi của nó.
  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const apply = () => paintHighlight(element, highlight ?? null);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [highlight, doc, pageNumber, scale]);

  // Toạ độ theo phần trăm của trang nên lớp phủ đúng với mọi mức zoom.
  const ocrRects = useMemo(
    () =>
      ocr && highlight
        ? ocrHighlightRects(ocr.words, highlight.query, highlight.ignoreDiacritics, ocr)
        : [],
    [ocr, highlight],
  );

  return (
    <div class="pdf-page" ref={pageRef}>
      <canvas ref={canvasRef} />
      <div class="textLayer" ref={textRef} />
      {ocr && (
        <>
          <div class="ocr-layer" aria-hidden="true">
            {ocrRects.map((rect, index) => (
              <div
                key={index}
                class="ocr-match"
                style={{
                  left: `${rect.left}%`,
                  top: `${rect.top}%`,
                  width: `${rect.width}%`,
                  height: `${rect.height}%`,
                }}
              />
            ))}
          </div>
          <span
            class={`ocr-badge${isLowConfidence(ocr.confidence) ? ' ocr-badge--low' : ''}`}
            title={isLowConfidence(ocr.confidence) ? vi.ocrPageBadgeLowTitle : vi.ocrPageBadgeTitle}
          >
            {vi.ocrPageBadge}
          </span>
        </>
      )}
    </div>
  );
}
