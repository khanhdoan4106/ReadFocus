import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ocrHighlightRects } from '../core/ocr/highlight';
import { isLowConfidence } from '../core/ocr/pages';
import type { OcrPageView } from '../core/ocr/types';
import type { Annotation, Rect } from '../core/annotate/types';
import { matchesQuery, spanInQuote } from '../core/search';
import { t } from '../i18n';
import { AnnotationLayer, hitTest } from './AnnotationLayer';
import type { PageSize } from './PageList';
import { reflowRects } from './text-layer-rects';

export type TextHighlight = {
  query: string;
  ignoreDiacritics: boolean;
  /** `query` là câu trích dẫn dài: tô các span nằm trong câu đó thay vì span chứa câu. */
  quote?: boolean;
};

type PdfPageProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  highlight?: TextHighlight | null;
  /** Trang có chữ do OCR nhận dạng: tô kết quả tìm kiếm bằng lớp phủ riêng và hiện nhãn. */
  ocr?: OcrPageView | null;
  /** Ghi chú và highlight của trang này (không gồm highlight chữ đã mồ côi). */
  annotations?: readonly Annotation[];
  areaMode?: boolean;
  flashId?: string | null;
  /** Văn bản đã trích của trang và các highlight `moved` cần tính lại rect từ text layer. */
  pageText?: string;
  reflow?: readonly { id: string; start: number; end: number }[];
  onReflow?: (id: string, start: number, end: number, rects: Rect[]) => void;
  /** Text layer đã dựng nhưng không ánh xạ được highlight này: người dùng cần cách gắn lại. */
  onReflowFailed?: (id: string) => void;
  onDrawArea?: (page: number, rect: Rect, x: number, y: number) => void;
  onOpenAnnotation?: (id: string, x: number, y: number) => void;
  onMeasured: (page: number, size: PageSize) => void;
  onRenderError: () => void;
};

function paintHighlight(container: HTMLElement, highlight: TextHighlight | null): void {
  for (const span of container.querySelectorAll<HTMLElement>('span')) {
    const matched =
      highlight !== null &&
      (highlight.quote === true
        ? spanInQuote(span.textContent ?? '', highlight.query, highlight.ignoreDiacritics)
        : matchesQuery(span.textContent ?? '', highlight.query, highlight.ignoreDiacritics));
    span.classList.toggle('textLayer__match', matched);
  }
}

export function PdfPage({
  doc,
  pageNumber,
  scale,
  highlight,
  ocr,
  annotations = [],
  areaMode = false,
  flashId = null,
  pageText,
  reflow,
  onReflow,
  onReflowFailed,
  onDrawArea,
  onOpenAnnotation,
  onMeasured,
  onRenderError,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  // Tăng mỗi lần text layer dựng xong: lúc đó mới tính lại được rect của highlight đã `moved`.
  const [layerVersion, setLayerVersion] = useState(0);
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
        if (!cancelled) setLayerVersion((value) => value + 1);
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

  // Highlight `moved`: tính lại rect từ khoảng ký tự mới trên text layer rồi báo để lưu đè.
  // Chưa có text layer hoặc ánh xạ thất bại thì không báo gì (và không vẽ rect cũ).
  useEffect(() => {
    const textElement = textRef.current;
    const pageElement = pageRef.current;
    if (layerVersion === 0 || !reflow || reflow.length === 0 || !pageText) return;
    if (!textElement || !pageElement || !onReflow) return;
    for (const item of reflow) {
      const rects = reflowRects(textElement, pageElement, pageText, item.start, item.end);
      if (rects !== null) onReflow(item.id, item.start, item.end, rects);
      else onReflowFailed?.(item.id);
    }
  }, [layerVersion, reflow, pageText, onReflow, onReflowFailed]);

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
    <div
      class="pdf-page"
      ref={pageRef}
      tabIndex={-1}
      onClick={(event) => {
        // Bấm vào highlight (không phải bôi đen chữ) thì mở popover của nó.
        if (areaMode || !onOpenAnnotation || !pageRef.current) return;
        if (window.getSelection()?.isCollapsed === false) return;
        const box = pageRef.current.getBoundingClientRect();
        const hit = hitTest(annotations, {
          x: (event.clientX - box.left) / box.width,
          y: (event.clientY - box.top) / box.height,
        });
        if (hit) onOpenAnnotation(hit.id, event.clientX, event.clientY);
      }}
    >
      <canvas ref={canvasRef} />
      <AnnotationLayer
        annotations={annotations}
        areaMode={areaMode}
        flashId={flashId}
        onDrawArea={(rect, x, y) => onDrawArea?.(pageNumber, rect, x, y)}
        onOpen={(id, x, y) => onOpenAnnotation?.(id, x, y)}
      />
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
            title={isLowConfidence(ocr.confidence) ? t.ocrPageBadgeLowTitle : t.ocrPageBadgeTitle}
          >
            {t.ocrPageBadge}
          </span>
        </>
      )}
    </div>
  );
}
