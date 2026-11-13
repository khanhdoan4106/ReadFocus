import { useMemo, useRef, useState } from 'preact/hooks';
import { filterAnnotations, groupByPage, type NoteFilter } from '../core/annotate/filter';
import {
  exportAnnotationsJson,
  exportAnnotationsMarkdown,
  mergeAnnotations,
  parseAnnotationsJson,
  type MarkdownLabels,
} from '../core/annotate/exchange';
import { ANNOTATION_COLORS, type Annotation } from '../core/annotate/types';
import { t } from '../i18n';
import type { AnnotationUi } from './hooks/useAnnotationUi';
import type { AnnotationsApi } from './hooks/useAnnotations';
import { downloadText, safeFileStem } from './notes-io';

export type NotesPanelProps = {
  api: AnnotationsApi;
  ui: AnnotationUi;
  docId: string | null;
  documentName: string;
  pageCount: number;
  onJump: (annotation: Annotation) => void;
  onCreateCard: (annotation: Annotation) => void;
  onReattach: (annotation: Annotation) => void;
  showToast: (message: string) => void;
};

function markdownLabels(): MarkdownLabels {
  return {
    pageHeading: t.notesPage,
    pageNote: t.notesKindPage,
    area: t.notesKindArea,
    note: t.annotNoteLabel,
    color: t.annotColorGroup,
    colors: t.annotColors,
  };
}

function preview(annotation: Annotation): string {
  if (annotation.anchor.type === 'text') return annotation.anchor.quote;
  return annotation.anchor.type === 'area' ? t.notesKindArea : t.notesKindPage;
}

function Entry({
  annotation,
  orphan,
  relocating,
  props,
}: {
  annotation: Annotation;
  orphan: boolean;
  /** Vị trí đã đổi, đang tính lại từ text layer (chưa vẽ trên trang). */
  relocating: boolean;
  props: NotesPanelProps;
}) {
  return (
    <li class={`notes__entry notes__entry--${annotation.color}`} data-note-id={annotation.id}>
      <button type="button" class="notes__jump" onClick={() => props.onJump(annotation)}>
        <span class="notes__quote">{preview(annotation)}</span>
        {annotation.note.trim() !== '' && <span class="notes__note">{annotation.note}</span>}
        <span class="notes__meta">
          {t.notesPage(annotation.page)} · {t.annotColors[annotation.color]}
        </span>
        {relocating && <span class="notes__relocating">{t.notesRelocating}</span>}
      </button>
      <div class="notes__actions">
        <button
          type="button"
          class="notes__action"
          onClick={(event) =>
            props.ui.openPopover(annotation.id, event.clientX, event.clientY, false)
          }
        >
          {t.notesEdit}
        </button>
        {annotation.anchor.type === 'text' && !orphan && (
          <button
            type="button"
            class="notes__action"
            onClick={() => props.onCreateCard(annotation)}
          >
            {t.notesFlashcard}
          </button>
        )}
        {orphan && (
          <button
            type="button"
            class="notes__action"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => props.onReattach(annotation)}
          >
            {t.notesReattach}
          </button>
        )}
        <button
          type="button"
          class="notes__action notes__action--danger"
          onClick={() => props.ui.askDelete(annotation.id)}
        >
          {t.annotDelete}
        </button>
      </div>
    </li>
  );
}

/** Tab Ghi chú: danh sách theo trang, lọc, tìm, khu mồ côi, xuất/nhập. Cũng là cách truy cập thay thế cho người không nhìn được highlight. */
export function NotesPanel(props: NotesPanelProps) {
  const { api, docId, documentName, pageCount, showToast } = props;
  const [filter, setFilter] = useState<NoteFilter>({
    color: 'all',
    query: '',
    ignoreDiacritics: true,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => filterAnnotations(api.items, filter), [api.items, filter]);
  const orphans = visible.filter((item) => api.statuses.get(item.id) === 'orphan');
  const regular = visible.filter((item) => api.statuses.get(item.id) !== 'orphan');
  const groups = useMemo(() => groupByPage(regular), [regular]);

  const exportMarkdown = () => {
    if (api.items.length === 0) return showToast(t.notesExportEmpty);
    downloadText(
      `${safeFileStem(documentName)}-notes.md`,
      exportAnnotationsMarkdown(documentName, api.items, markdownLabels()),
      'text/markdown',
    );
  };

  const exportJson = () => {
    if (docId === null || api.items.length === 0) return showToast(t.notesExportEmpty);
    downloadText(
      `${safeFileStem(documentName)}-notes.json`,
      exportAnnotationsJson({ id: docId, name: documentName, pageCount }, api.items),
      'application/json',
    );
  };

  const importFile = async (file: File) => {
    if (docId === null) return;
    const parsed = parseAnnotationsJson(await file.text(), docId);
    if (!parsed.ok) {
      showToast(t.notesImportErrors[parsed.error]);
      return;
    }
    const result = mergeAnnotations(api.items, parsed.annotations);
    if (result.toWrite.length > 0) api.replaceMany(result.toWrite);
    showToast(t.notesImportDone(result.added, result.updated));
  };

  return (
    <div class="notes">
      <p class="notes__hint">{t.notesDataHint}</p>

      {api.items.length === 0 ? (
        <p class="sidebar__empty">{t.notesEmpty}</p>
      ) : (
        <>
          <div class="notes__filters">
            <label class="notes__field">
              <span class="visually-hidden">{t.notesFilterColor}</span>
              <select
                value={filter.color}
                aria-label={t.notesFilterColor}
                onChange={(event) =>
                  setFilter({
                    ...filter,
                    color: event.currentTarget.value as NoteFilter['color'],
                  })
                }
              >
                <option value="all">{t.notesColorAll}</option>
                {ANNOTATION_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {t.annotColors[color]}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="search"
              class="notes__search"
              placeholder={t.notesSearchPlaceholder}
              aria-label={t.notesSearchPlaceholder}
              value={filter.query}
              onInput={(event) => setFilter({ ...filter, query: event.currentTarget.value })}
            />
            <label class="search__toggle">
              <input
                type="checkbox"
                checked={filter.ignoreDiacritics}
                onChange={(event) =>
                  setFilter({ ...filter, ignoreDiacritics: event.currentTarget.checked })
                }
              />
              {t.searchIgnoreDiacritics}
            </label>
          </div>

          <p class="notes__count" role="status">
            {t.notesCount(visible.length)}
          </p>
          {visible.length === 0 && <p class="sidebar__empty">{t.notesNoMatch}</p>}

          {groups.map(([page, items]) => (
            <section key={page} class="notes__group" aria-label={t.notesPage(page)}>
              <h3 class="notes__page">{t.notesPage(page)}</h3>
              <ul class="notes__list">
                {items.map((item) => (
                  <Entry
                    key={item.id}
                    annotation={item}
                    orphan={false}
                    relocating={api.statuses.get(item.id) === 'moved'}
                    props={props}
                  />
                ))}
              </ul>
            </section>
          ))}

          {orphans.length > 0 && (
            <section class="notes__group notes__orphans" aria-label={t.notesOrphanTitle}>
              <h3 class="notes__page">{t.notesOrphanTitle}</h3>
              <p class="notes__hint">{t.notesOrphanHint}</p>
              <ul class="notes__list">
                {orphans.map((item) => (
                  <Entry key={item.id} annotation={item} orphan relocating={false} props={props} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div class="notes__io">
        <button type="button" class="settings-button" onClick={exportMarkdown}>
          {t.notesExportMarkdown}
        </button>
        <button type="button" class="settings-button" onClick={exportJson}>
          {t.notesExportJson}
        </button>
        <button type="button" class="settings-button" onClick={() => fileRef.current?.click()}>
          {t.notesImportJson}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label={t.notesImportJson}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
    </div>
  );
}
