import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import { useEffect, useRef } from 'preact/hooks';
import type { PageSize } from './PageList';

type PdfPageProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  onMeasured: (page: number, size: PageSize) => void;
  onRenderError: () => void;
};

export function PdfPage({ doc, pageNumber, scale, onMeasured, onRenderError }: PdfPageProps) {
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

  return (
    <div class="pdf-page" ref={pageRef}>
      <canvas ref={canvasRef} />
      <div class="textLayer" ref={textRef} />
    </div>
  );
}
