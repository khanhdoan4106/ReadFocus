export type TimerMode = 'chapter' | 'focus' | 'break';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type FocusTimer = {
  mode: TimerMode;
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  startedAt: number | null;
};

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;
export const DEFAULT_IDLE_PAUSE_MS = 60 * 1000;
export const DEFAULT_BAND_HEIGHT = 140;
export const MIN_BAND_HEIGHT = 40;
export const MAX_BAND_HEIGHT = 400;

/** Kẹp số phút cấu hình Pomodoro vào khoảng dùng được. */
export function clampMinutes(value: number, min = 1, max = 180): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Kẹp chiều cao dải sáng của chế độ tập trung. */
export function clampBandHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BAND_HEIGHT;
  return Math.min(Math.max(Math.round(value), MIN_BAND_HEIGHT), MAX_BAND_HEIGHT);
}

export function startTimer(mode: TimerMode, durationMs: number, now: number): FocusTimer {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(Math.round(durationMs), 0) : 0;
  return {
    mode,
    status: safeDuration === 0 ? 'finished' : 'running',
    durationMs: safeDuration,
    remainingMs: safeDuration,
    startedAt: safeDuration === 0 ? null : now,
  };
}

/** Thời gian còn lại tại thời điểm `now`, kể cả phần đang chạy dở. */
export function timerRemaining(timer: FocusTimer, now: number): number {
  if (timer.status !== 'running' || timer.startedAt === null) return timer.remainingMs;
  return Math.max(timer.remainingMs - Math.max(now - timer.startedAt, 0), 0);
}

export function pauseTimer(timer: FocusTimer, now: number): FocusTimer {
  if (timer.status !== 'running') return timer;
  return {
    ...timer,
    status: 'paused',
    remainingMs: timerRemaining(timer, now),
    startedAt: null,
  };
}

export function resumeTimer(timer: FocusTimer, now: number): FocusTimer {
  if (timer.status !== 'paused' || timer.remainingMs <= 0) return timer;
  return { ...timer, status: 'running', startedAt: now };
}

/** Chốt trạng thái khi hết giờ; các lần gọi lặp lại không đổi gì. */
export function tickTimer(timer: FocusTimer, now: number): FocusTimer {
  if (timer.status !== 'running') return timer;
  if (timerRemaining(timer, now) > 0) return timer;
  return { ...timer, status: 'finished', remainingMs: 0, startedAt: null };
}

export function stopTimer(timer: FocusTimer): FocusTimer {
  return { ...timer, status: 'idle', remainingMs: timer.durationMs, startedAt: null };
}

/** Hết một pha Pomodoro thì chuyển sang pha kế tiếp, giữ chu kỳ tập trung/nghỉ. */
export function nextPomodoroPhase(
  timer: FocusTimer,
  focusMinutes: number,
  breakMinutes: number,
  now: number,
): FocusTimer | null {
  if (timer.mode === 'focus') {
    return startTimer('break', clampMinutes(breakMinutes) * 60_000, now);
  }
  if (timer.mode === 'break') {
    return startTimer('focus', clampMinutes(focusMinutes) * 60_000, now);
  }
  return null;
}

/** Hiển thị mm:ss; phút có thể vượt 59 với phiên đọc chương dài. */
export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Tự tạm dừng khi người dùng không hoạt động quá ngưỡng. */
export function shouldAutoPause(
  lastActivityAt: number,
  now: number,
  idleMs = DEFAULT_IDLE_PAUSE_MS,
): boolean {
  if (!Number.isFinite(lastActivityAt) || !Number.isFinite(now)) return false;
  return now - lastActivityAt >= Math.max(idleMs, 0);
}
