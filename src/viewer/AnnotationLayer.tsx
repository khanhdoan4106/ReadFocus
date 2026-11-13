import { useRef, useState } from 'preact/hooks';
import type { Annotation, Rect } from '../core/annotate/types';
import { t } from '../i18n';

type Props = {
  /** Chú thích của trang này (không gồm highlight chữ đã mồ côi). */
  annotations: readonly Annotation[];
  areaMode: boolean;
  onDrawArea: (rect: Rect, x: number, y: number) => void;
  onOpen: (id: string, x: number, y: number) => void;
};

function style(rect: Rect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}

function rectsOf(annotation: Annotation): Rect[] {
  if (annotation.anchor.type === 'text') return annotation.anchor.rects;
  if (annotation.anchor.type === 'area') return [annotation.anchor.rect];
  return [];
}

/** Tọa độ chuẩn hóa của con trỏ so với phần tử, kẹp trong 0..1. */
function pointIn(element: HTMLElement, event: PointerEvent): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return {
    x: clamp((event.clientX - box.left) / (box.width || 1)),
    y: clamp((event.clientY - box.top) / (box.height || 1)),
  };
}

/**
 * Lớp vẽ highlight của một trang. Tọa độ là phần trăm của trang nên đúng với mọi mức zoom.
 * Các highlight nằm DƯỚI text layer để không chặn bôi đen chữ; bấm vào highlight được nhận
 * bằng `onClick` của trang (xem `hitTest`). Ghi chú trang là các nút thật, nằm ở mép trái trang.
 */
export function AnnotationLayer({ annotations, areaMode, onDrawArea, onOpen }: Props) {
  const drawRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  const preview: Rect | null =
    start && current
      ? {
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          w: Math.abs(start.x - current.x),
          h: Math.abs(start.y - current.y),
        }
      : null;

  const pageNotes = annotations.filter((a) => a.anchor.type === 'page');

  return (
    <>
      <div class="annot-layer">
        {annotations.flatMap((annotation) =>
          rectsOf(annotation).map((rect, index) => (
            <div
              key={`${annotation.id}-${index}`}
              class={`annot-rect annot-rect--${annotation.color}${
                annotation.anchor.type === 'area' ? ' annot-rect--area' : ''
              }`}
              data-annotation-id={annotation.id}
              role="img"
              aria-label={
                annotation.anchor.type === 'text'
                  ? t.annotTextAria(t.annotColors[annotation.color], annotation.anchor.quote)
                  : t.annotAreaAria(t.annotColors[annotation.color])
              }
              style={style(rect)}
            />
          )),
        )}
      </div>

      {pageNotes.length > 0 && (
        <div class="annot-page-notes">
          {pageNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              class={`annot-page-note annot-rect--${note.color}`}
              aria-label={t.annotPageNoteAria(
                note.note.trim() === '' ? t.annotPageNoteEmpty : note.note.trim().slice(0, 60),
              )}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(note.id, event.clientX, event.clientY);
              }}
            >
              ✎
            </button>
          ))}
        </div>
      )}

      {areaMode && (
        <div
          ref={drawRef}
          class="annot-draw"
          role="application"
          aria-label={t.annotAreaLayer}
          onPointerDown={(event) => {
            if (!drawRef.current) return;
            drawRef.current.setPointerCapture(event.pointerId);
            const point = pointIn(drawRef.current, event);
            setStart(point);
            setCurrent(point);
          }}
          onPointerMove={(event) => {
            if (start && drawRef.current) setCurrent(pointIn(drawRef.current, event));
          }}
          onPointerUp={(event) => {
            if (start && preview) onDrawArea(preview, event.clientX, event.clientY);
            setStart(null);
            setCurrent(null);
          }}
          onPointerCancel={() => {
            setStart(null);
            setCurrent(null);
          }}
        >
          {preview && <div class="annot-rect annot-rect--preview" style={style(preview)} />}
        </div>
      )}
    </>
  );
}

/** Tìm highlight chứa điểm (đã chuẩn hóa) ở trang; cái tạo sau nằm trên nên duyệt ngược. */
export function hitTest(
  annotations: readonly Annotation[],
  point: { x: number; y: number },
): Annotation | null {
  for (let i = annotations.length - 1; i >= 0; i -= 1) {
    const annotation = annotations[i] as Annotation;
    const hit = rectsOf(annotation).some(
      (r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h,
    );
    if (hit) return annotation;
  }
  return null;
}
