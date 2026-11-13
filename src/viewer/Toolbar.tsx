import type { RefObject } from 'preact';
import type { DocKind } from '../core/profile';
import type { FocusTimer } from '../core/focus';
import { formatTimer } from '../core/focus';
import { t } from '../i18n';

import { profileLabel, timerModeLabel } from './labels';

type Props = {
  ready: boolean;
  fileName: string;
  /** Loại tài liệu đã nhận biết; `null` khi chưa phân tích xong. */
  profileKind: DocKind | null;
  timer: FocusTimer;
  remainingMs: number;
  pageNumber: number;
  pageDraft: string;
  totalPages: number;
  scale: number;
  sidebarOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpenFile: (file: File) => void;
  onPrevious: () => void;
  onNext: () => void;
  onChangePageDraft: (value: string) => void;
  onCommitPageDraft: () => void;
  onZoom: (direction: 1 | -1) => void;
  onFitWidth: () => void;
  onToggleTimer: () => void;
  onToggleSidebar: () => void;
};

export function Toolbar({
  ready,
  fileName,
  profileKind,
  timer,
  remainingMs,
  pageNumber,
  pageDraft,
  totalPages,
  scale,
  sidebarOpen,
  inputRef,
  onOpenFile,
  onPrevious,
  onNext,
  onChangePageDraft,
  onCommitPageDraft,
  onZoom,
  onFitWidth,
  onToggleTimer,
  onToggleSidebar,
}: Props) {
  return (
    <header class="toolbar" role="group" aria-label="Điều khiển tài liệu">
      <button
        type="button"
        class="toolbar__button toolbar__button--primary"
        onClick={() => inputRef.current?.click()}
      >
        {t.openFile}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void onOpenFile(file);
          event.currentTarget.value = '';
        }}
      />

      <span class="toolbar__name" title={fileName}>
        {fileName || t.fileNameUnknown}
      </span>

      {profileKind !== null && <span class="toolbar__profile">{profileLabel(profileKind)}</span>}

      {timer.status !== 'idle' && (
        <button
          type="button"
          class={`toolbar__button toolbar__timer${
            timer.status === 'paused' ? ' toolbar__timer--paused' : ''
          }`}
          aria-label={t.timerToggleAria(timerModeLabel(timer.mode), formatTimer(remainingMs))}
          onClick={onToggleTimer}
        >
          <span class="toolbar__timer-mode">{timerModeLabel(timer.mode)}</span>
          <span class="toolbar__timer-time">{formatTimer(remainingMs)}</span>
        </button>
      )}

      <div class="toolbar__group">
        <button
          type="button"
          class="toolbar__button"
          aria-label={t.previousPage}
          disabled={!ready || pageNumber <= 1}
          onClick={() => onPrevious()}
        >
          ←
        </button>
        <input
          class="toolbar__page"
          type="number"
          min={1}
          max={totalPages}
          aria-label={t.pageInputLabel}
          value={pageDraft}
          disabled={!ready}
          onInput={(event) => onChangePageDraft(event.currentTarget.value)}
          onBlur={onCommitPageDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCommitPageDraft();
          }}
        />
        <span class="toolbar__total">{t.pageLabel(pageNumber, Math.max(totalPages, 1))}</span>
        <button
          type="button"
          class="toolbar__button"
          aria-label={t.nextPage}
          disabled={!ready || pageNumber >= totalPages}
          onClick={() => onNext()}
        >
          →
        </button>
      </div>

      <div class="toolbar__group">
        <button
          type="button"
          class="toolbar__button"
          aria-label={t.zoomOut}
          disabled={!ready}
          onClick={() => onZoom(-1)}
        >
          −
        </button>
        <span class="toolbar__zoom">{t.zoomLabel(Math.round(scale * 100))}</span>
        <button
          type="button"
          class="toolbar__button"
          aria-label={t.zoomIn}
          disabled={!ready}
          onClick={() => onZoom(1)}
        >
          +
        </button>
        <button type="button" class="toolbar__button" disabled={!ready} onClick={onFitWidth}>
          {t.zoomFitWidth}
        </button>
      </div>

      <button
        type="button"
        class="toolbar__button"
        aria-label={t.tocTitle}
        aria-expanded={sidebarOpen}
        aria-controls="viewer-sidebar"
        disabled={!ready}
        onClick={() => onToggleSidebar()}
      >
        {t.tocTitle}
      </button>
    </header>
  );
}
