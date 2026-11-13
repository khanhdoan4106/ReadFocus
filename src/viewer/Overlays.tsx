import type { FocusTimer } from '../core/focus';
import type { ProviderId } from '../core/llm/types';
import { formatTimer } from '../core/focus';
import { t } from '../i18n';
import { Dialog } from './Dialog';

import { timerModeLabel } from './labels';

export function FocusOverlay({
  bandTop,
  bandHeight,
  timer,
  remainingMs,
  fullscreen,
  onToggleFullscreen,
  onExit,
}: {
  bandTop: number;
  bandHeight: number;
  timer: FocusTimer;
  remainingMs: number;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onExit: () => void;
}) {
  return (
    <>
      <div
        class="focus-band"
        style={{ top: `${bandTop}px`, height: `${bandHeight}px` }}
        aria-hidden="true"
      />
      <div class="focus-controls" role="group" aria-label={t.focusModeTitle}>
        {timer.status !== 'idle' && (
          <span class="focus-controls__timer">
            {timerModeLabel(timer.mode)} · {formatTimer(remainingMs)}
          </span>
        )}
        <button type="button" class="focus-button" onClick={onToggleFullscreen}>
          {fullscreen ? t.focusExitFullscreen : t.focusFullscreen}
        </button>
        <button type="button" class="focus-button focus-button--primary" onClick={onExit}>
          {t.focusModeOff}
        </button>
      </div>
      <p class="focus-move-hint">{t.focusMoveHint}</p>
    </>
  );
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div class="toast" role="status">
      <span>{message}</span>
      <button
        type="button"
        class="toast__close"
        aria-label={t.toastDismiss}
        onClick={() => onDismiss()}
      >
        ×
      </button>
    </div>
  );
}

/** Hộp thoại xin đồng ý trước khi gửi nội dung tài liệu cho nhà cung cấp AI. */
export function ConsentDialog({
  providerId,
  onAccept,
  onCancel,
}: {
  providerId: ProviderId;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog titleId="ai-consent-title" onClose={onCancel}>
      <h2 class="consent-dialog__title" id="ai-consent-title">
        {t.aiConsentTitle}
      </h2>
      <p class="consent-dialog__body">{t.aiConsentBody(t.aiProviders[providerId])}</p>
      <div class="consent-dialog__actions">
        <button type="button" class="settings-button settings-button--primary" onClick={onAccept}>
          {t.aiConsentAccept}
        </button>
        <button type="button" class="settings-button" onClick={onCancel}>
          {t.aiConsentCancel}
        </button>
      </div>
    </Dialog>
  );
}
