import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { computeVisiblePages, type PageOffset } from '../core/virtualize';
import type { Annotation, Rect } from '../core/annotate/types';
import type { OcrPageView } from '../core/ocr/types';
import { PdfPage, type TextHighlight } from './PdfPage';

export type PageSize = { width: number; height: number };

type PageListProps = {
  doc: PDFDocumentProxy;
  scale: number;
  sizes: Record<number, PageSize>;
  fallbackSize: PageSize;
  highlight: (TextHighlight & { page: number }) | null;
  ocrPages: ReadonlyMap<number, OcrPageView>;
  annotations: ReadonlyMap<number, readonly Annotation[]>;
  areaMode: boolean;
  onDrawArea: (page: number, rect: Rect, x: number, y: number) => void;
  onOpenAnnotation: (id: string, x: number, y: number) => void;
  scrollerRef: RefObject<HTMLElement | null>;
  onMeasured: (page: number, size: PageSize) => void;
  onCurrentPageChange: (page: number) => void;
  onRenderError: () => void;
};

function samePages(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const page of a) {
    if (!b.has(page)) return false;
  }
  return true;
}

export function PageList({
  doc,
  scale,
  sizes,
  fallbackSize,
  highlight,
  ocrPages,
  annotations,
  areaMode,
  onDrawArea,
  onOpenAnnotation,
  scrollerRef,
  onMeasured,
  onCurrentPageChange,
  onRenderError,
}: PageListProps) {
  const [activePages, setActivePages] = useState<ReadonlySet<number>>(() => new Set([1, 2]));
  const listRef = useRef<HTMLDivElement>(null);
  const currentPageHandlerRef = useRef(onCurrentPageChange);
  currentPageHandlerRef.current = onCurrentPageChange;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      timer = undefined;
      const slots = list.querySelectorAll<HTMLElement>('.page-slot');
      const offsets: PageOffset[] = [];

      for (const slot of slots) {
        const page = Number(slot.dataset.page);
        if (!Number.isFinite(page)) continue;
        offsets.push({ page, top: slot.offsetTop, height: slot.offsetHeight });
      }

      const { active, current } = computeVisiblePages(
        offsets,
        scroller.scrollTop,
        scroller.clientHeight,
      );

      setActivePages((previous) => {
        const next = new Set(active);
        return samePages(previous, next) ? previous : next;
      });
      currentPageHandlerRef.current(current);
    };

    const onScroll = () => {
      if (timer === undefined) timer = setTimeout(update, 50);
    };

    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [doc, scale, sizes, scrollerRef]);

  const pages = Array.from({ length: doc.numPages }, (_, index) => index + 1);

  return (
    <div class="page-list" ref={listRef}>
      {pages.map((pageNumber) => {
        const size = sizes[pageNumber] ?? fallbackSize;
        const width = Math.floor(size.width * scale);
        const height = Math.floor(size.height * scale);
        const isActive = activePages.has(pageNumber);

        return (
          <div
            key={pageNumber}
            class="page-slot"
            data-page={pageNumber}
            style={{ minHeight: `${height}px`, width: `${width}px` }}
          >
            {isActive ? (
              <PdfPage
                doc={doc}
                pageNumber={pageNumber}
                scale={scale}
                highlight={highlight && highlight.page === pageNumber ? highlight : null}
                ocr={ocrPages.get(pageNumber) ?? null}
                annotations={annotations.get(pageNumber)}
                areaMode={areaMode}
                onDrawArea={onDrawArea}
                onOpenAnnotation={onOpenAnnotation}
                onMeasured={onMeasured}
                onRenderError={onRenderError}
              />
            ) : (
              <div class="page-slot__placeholder" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
