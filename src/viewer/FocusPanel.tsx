import { formatTimer, MAX_BAND_HEIGHT, MIN_BAND_HEIGHT, type FocusTimer } from '../core/focus';
import { totalReading, type DayStats } from '../core/stats';
import { vi } from '../i18n/vi';

export type FocusPanelProps = {
  timer: FocusTimer;
  remainingMs: number;
  chapterMinutes: number;
  focusMinutes: number;
  breakMinutes: number;
  bandHeight: number;
  fullscreen: boolean;
  statsToday: DayStats;
  statsRecent: readonly DayStats[];
  onStartChapter: () => void;
  onStartPomodoro: () => void;
  onToggleTimer: () => void;
  onStopTimer: () => void;
  onChangeFocusMinutes: (value: number) => void;
  onChangeBreakMinutes: (value: number) => void;
  onChangeBandHeight: (value: number) => void;
  onToggleFocusMode: () => void;
  onToggleFullscreen: () => void;
};

function modeLabel(mode: FocusTimer['mode']): string {
  switch (mode) {
    case 'chapter':
      return vi.timerModeChapter;
    case 'focus':
      return vi.timerModeFocus;
    case 'break':
      return vi.timerModeBreak;
  }
}

function statusLabel(timer: FocusTimer): string | null {
  switch (timer.status) {
    case 'running':
      return vi.timerStatusRunning;
    case 'paused':
      return vi.timerStatusPaused;
    case 'finished':
      return vi.timerStatusFinished;
    case 'idle':
      return null;
  }
}

export function FocusPanel({
  timer,
  remainingMs,
  chapterMinutes,
  focusMinutes,
  breakMinutes,
  bandHeight,
  fullscreen,
  statsToday,
  statsRecent,
  onStartChapter,
  onStartPomodoro,
  onToggleTimer,
  onStopTimer,
  onChangeFocusMinutes,
  onChangeBreakMinutes,
  onChangeBandHeight,
  onToggleFocusMode,
  onToggleFullscreen,
}: FocusPanelProps) {
  const status = statusLabel(timer);
  const week = totalReading(statsRecent);
  const active = timer.status === 'running' || timer.status === 'paused';

  return (
    <div class="focus-panel">
      <section class="focus-card">
        <h3 class="focus-card__title">{vi.chapterTimerTitle}</h3>
        <p class="focus-card__hint">{vi.chapterTimerHint}</p>
        <button
          type="button"
          class="focus-button focus-button--primary"
          disabled={chapterMinutes <= 0}
          onClick={onStartChapter}
        >
          {vi.chapterTimerStart}
          {chapterMinutes > 0 ? ` · ${vi.readingMinutes(chapterMinutes)}` : ''}
        </button>
        {chapterMinutes <= 0 && <p class="focus-card__hint">{vi.chapterTimerUnavailable}</p>}
      </section>

      <section class="focus-card">
        <h3 class="focus-card__title">{vi.pomodoroTitle}</h3>
        <p class="focus-card__hint">{vi.pomodoroHint}</p>
        <div class="focus-fields">
          <label class="focus-field">
            <span>{vi.focusMinutesLabel}</span>
            <input
              type="number"
              min={1}
              max={180}
              value={focusMinutes}
              onInput={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isFinite(value)) onChangeFocusMinutes(value);
              }}
            />
          </label>
          <label class="focus-field">
            <span>{vi.breakMinutesLabel}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              onInput={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isFinite(value)) onChangeBreakMinutes(value);
              }}
            />
          </label>
        </div>

        <div class="focus-timer" aria-live="polite">
          <div class="focus-timer__row">
            <span class="focus-timer__mode">{modeLabel(timer.mode)}</span>
            <span class="focus-timer__value">{formatTimer(remainingMs)}</span>
          </div>
          {timer.durationMs > 0 && (
            <progress
              class="focus-timer__progress"
              value={timer.durationMs - remainingMs}
              max={timer.durationMs}
              aria-label={vi.timerModeFocus}
            />
          )}
          {status !== null && <p class="focus-timer__status">{status}</p>}
        </div>

        <div class="focus-actions">
          {active ? (
            <button type="button" class="focus-button" onClick={onToggleTimer}>
              {timer.status === 'running' ? vi.timerPause : vi.timerResume}
            </button>
          ) : (
            <button type="button" class="focus-button" onClick={onStartPomodoro}>
              {vi.pomodoroStart}
            </button>
          )}
          {timer.status !== 'idle' && (
            <button type="button" class="focus-button" onClick={onStopTimer}>
              {vi.timerStop}
            </button>
          )}
        </div>
      </section>

      <section class="focus-card">
        <h3 class="focus-card__title">{vi.focusModeTitle}</h3>
        <p class="focus-card__hint">{vi.focusModeHint}</p>
        <label class="focus-field focus-field--range">
          <span>{vi.focusBandLabel}</span>
          <input
            type="range"
            min={MIN_BAND_HEIGHT}
            max={MAX_BAND_HEIGHT}
            step={10}
            value={bandHeight}
            onInput={(event) => onChangeBandHeight(Number(event.currentTarget.value))}
          />
          <span class="focus-field__value">{vi.focusBandValue(bandHeight)}</span>
        </label>
        <div class="focus-actions">
          <button
            type="button"
            class="focus-button focus-button--primary"
            onClick={onToggleFocusMode}
          >
            {vi.focusModeOn}
          </button>
          <button type="button" class="focus-button" onClick={onToggleFullscreen}>
            {fullscreen ? vi.focusExitFullscreen : vi.focusFullscreen}
          </button>
        </div>
      </section>

      <section class="focus-card">
        <h3 class="focus-card__title">{vi.statsTitle}</h3>
        <dl class="focus-stats">
          <div class="focus-stats__row">
            <dt>{vi.statsToday}</dt>
            <dd>{vi.statsSummary(Math.round(statsToday.minutes), statsToday.pages)}</dd>
          </div>
          <div class="focus-stats__row">
            <dt>{vi.statsRecent}</dt>
            <dd>{vi.statsSummary(Math.round(week.minutes), week.pages)}</dd>
          </div>
        </dl>
        {statsToday.pages === 0 && statsRecent.length === 0 && (
          <p class="focus-card__hint">{vi.statsEmpty}</p>
        )}
      </section>
    </div>
  );
}
