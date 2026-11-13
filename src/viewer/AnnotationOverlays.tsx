import { useEffect, useRef, useState } from 'preact/hooks';
import { ANNOTATION_COLORS, type Annotation, type AnnotationColor } from '../core/annotate/types';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import type { AnnotationUi } from './hooks/useAnnotationUi';
import type { AnnotationsApi } from './hooks/useAnnotations';

function clampToViewport(x: number, y: number, width: number, height: number) {
  return {
    // Preact 11 không tự thêm "px" cho số: phải ghi đơn vị.
    left: `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`,
    top: `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`,
  };
}

function ColorChoices({
  value,
  onPick,
  action,
}: {
  value: AnnotationColor | null;
  onPick: (color: AnnotationColor) => void;
  action: (color: string) => string;
}) {
  return (
    <>
      {ANNOTATION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role={value === null ? undefined : 'radio'}
          aria-checked={value === null ? undefined : value === color}
          class={`annot-swatch annot-rect--${color}${value === color ? ' annot-swatch--on' : ''}`}
          aria-label={action(t.annotColors[color])}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(color)}
        />
      ))}
    </>
  );
}

/** Thanh nổi cạnh vùng chữ vừa bôi đen: 4 màu và "Thêm ghi chú". */
function SelectionBar({ ui }: { ui: AnnotationUi }) {
  const bar = ui.bar;
  if (bar === null) return null;
  const pos = clampToViewport(bar.anchor.x, bar.anchor.y + 8, 260, 44);
  return (
    <div class="annot-bar" role="toolbar" aria-label={t.annotBarLabel} style={pos}>
      <ColorChoices
        value={null}
        action={t.annotColorAction}
        onPick={(color) => ui.highlightSelection(color, false)}
      />
      <button
        type="button"
        class="annot-bar__note"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => ui.highlightSelection(ui.color, true)}
      >
        {t.annotAddNote}
      </button>
    </div>
  );
}

/** Popover sửa màu và ghi chú của một highlight; Esc hoặc "Xong" lưu và đóng. */
function Popover({
  annotation,
  ui,
  api,
}: {
  annotation: Annotation;
  ui: AnnotationUi;
  api: AnnotationsApi;
}) {
  const state = ui.popover;
  const [note, setNote] = useState(annotation.note);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(note);
  draftRef.current = note;
  const savedRef = useRef(annotation.note);

  const commit = () => {
    if (draftRef.current !== savedRef.current) {
      savedRef.current = draftRef.current;
      api.change(annotation.id, { note: draftRef.current });
    }
  };

  useEffect(() => {
    (state?.focusNote
      ? noteRef.current
      : rootRef.current?.querySelector<HTMLElement>('button')
    )?.focus();
    return commit;
    // Chỉ chạy khi mở/đóng: lúc đóng thì lưu bản nháp.
  }, [annotation.id]);

  // Bấm ra ngoài popover thì lưu và đóng (trừ khi đang hỏi xác nhận xoá: hộp đó nằm ngoài popover).
  const deleting = ui.deleting;
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (deleting !== null) return;
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      commit();
      ui.closePopover();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // `commit` và `ui.closePopover` đổi theo mỗi lần render nhưng chỉ đọc giá trị mới nhất qua ref.
  });

  if (state === null) return null;
  const pos = clampToViewport(state.x, state.y + 8, 300, 230);
  return (
    <div
      ref={rootRef}
      class="annot-popover"
      role="dialog"
      aria-label={t.annotPopoverLabel}
      style={pos}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          commit();
          ui.closePopover();
        }
      }}
    >
      <div class="annot-popover__colors" role="radiogroup" aria-label={t.annotColorGroup}>
        <ColorChoices
          value={annotation.color}
          action={t.annotColorOption}
          onPick={(color) => api.change(annotation.id, { color })}
        />
      </div>
      {annotation.anchor.type === 'text' && (
        <blockquote class="annot-popover__quote">{annotation.anchor.quote}</blockquote>
      )}
      <label class="annot-popover__label">
        <span>{t.annotNoteLabel}</span>
        <textarea
          ref={noteRef}
          rows={4}
          value={note}
          placeholder={t.annotNotePlaceholder}
          onInput={(event) => setNote(event.currentTarget.value)}
          onBlur={commit}
        />
      </label>
      <div class="annot-popover__actions">
        <button
          type="button"
          class="settings-button settings-button--primary"
          onClick={() => {
            commit();
            ui.closePopover();
          }}
        >
          {t.annotDone}
        </button>
        <button
          type="button"
          class="settings-button settings-button--danger"
          onClick={() => {
            commit();
            ui.askDelete(annotation.id);
          }}
        >
          {t.annotDelete}
        </button>
      </div>
    </div>
  );
}

export function AnnotationOverlays({ ui, api }: { ui: AnnotationUi; api: AnnotationsApi }) {
  const open = ui.popover ? api.items.find((item) => item.id === ui.popover?.id) : undefined;
  return (
    <>
      <SelectionBar ui={ui} />
      {open && <Popover key={open.id} annotation={open} ui={ui} api={api} />}
      {ui.deleting !== null && (
        <Dialog titleId="annot-delete-title" onClose={ui.cancelDelete}>
          <h2 class="consent-dialog__title" id="annot-delete-title">
            {t.annotDeleteTitle}
          </h2>
          <p class="consent-dialog__body">{t.annotDeleteBody}</p>
          <div class="consent-dialog__actions">
            <button
              type="button"
              class="settings-button settings-button--danger"
              onClick={() => void ui.confirmDelete()}
            >
              {t.annotDeleteConfirm}
            </button>
            <button type="button" class="settings-button" onClick={ui.cancelDelete}>
              {t.annotDeleteCancel}
            </button>
          </div>
        </Dialog>
      )}
      {api.failed && (
        <p class="annot-failed" role="alert">
          {t.annotSaveFailed}
        </p>
      )}
    </>
  );
}
