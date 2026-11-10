import { describe, expect, it } from 'vitest';
import {
  clampBandHeight,
  clampMinutes,
  DEFAULT_BAND_HEIGHT,
  formatTimer,
  MAX_BAND_HEIGHT,
  MIN_BAND_HEIGHT,
  nextPomodoroPhase,
  pauseTimer,
  resumeTimer,
  shouldAutoPause,
  startTimer,
  stopTimer,
  tickTimer,
  timerRemaining,
} from '../src/core/focus';

describe('clampMinutes', () => {
  it('kẹp số phút vào khoảng cho phép và làm tròn', () => {
    expect(clampMinutes(25)).toBe(25);
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(500)).toBe(180);
    expect(clampMinutes(24.6)).toBe(25);
    expect(clampMinutes(Number.NaN)).toBe(1);
  });
});

describe('clampBandHeight', () => {
  it('kẹp chiều cao dải sáng', () => {
    expect(clampBandHeight(140)).toBe(140);
    expect(clampBandHeight(1)).toBe(MIN_BAND_HEIGHT);
    expect(clampBandHeight(9999)).toBe(MAX_BAND_HEIGHT);
    expect(clampBandHeight(Number.NaN)).toBe(DEFAULT_BAND_HEIGHT);
  });
});

describe('startTimer', () => {
  it('bắt đầu chạy với thời lượng đã đặt', () => {
    const timer = startTimer('focus', 25 * 60_000, 1_000);
    expect(timer.status).toBe('running');
    expect(timer.remainingMs).toBe(25 * 60_000);
    expect(timer.startedAt).toBe(1_000);
  });

  it('thời lượng 0 thì kết thúc ngay', () => {
    const timer = startTimer('chapter', 0, 1_000);
    expect(timer.status).toBe('finished');
    expect(timer.startedAt).toBeNull();
  });
});

describe('timerRemaining', () => {
  it('trừ dần thời gian đã trôi qua', () => {
    const timer = startTimer('chapter', 60_000, 0);
    expect(timerRemaining(timer, 15_000)).toBe(45_000);
  });

  it('không xuống dưới 0 và bỏ qua thời gian âm', () => {
    const timer = startTimer('chapter', 60_000, 10_000);
    expect(timerRemaining(timer, 100_000)).toBe(0);
    expect(timerRemaining(timer, 5_000)).toBe(60_000);
  });

  it('giữ nguyên khi đang tạm dừng', () => {
    const timer = {
      ...startTimer('focus', 60_000, 0),
      status: 'paused' as const,
      remainingMs: 30_000,
    };
    expect(timerRemaining(timer, 90_000)).toBe(30_000);
  });
});

describe('pauseTimer / resumeTimer', () => {
  it('chốt thời gian còn lại khi tạm dừng và chạy tiếp từ đó', () => {
    const running = startTimer('focus', 60_000, 1_000);
    const paused = pauseTimer(running, 16_000);
    expect(paused.status).toBe('paused');
    expect(paused.remainingMs).toBe(45_000);
    expect(paused.startedAt).toBeNull();

    const resumed = resumeTimer(paused, 30_000);
    expect(resumed.status).toBe('running');
    expect(resumed.startedAt).toBe(30_000);
    expect(timerRemaining(resumed, 40_000)).toBe(35_000);
  });

  it('không tạm dừng khi đã dừng hoặc đã hết giờ', () => {
    const idle = startTimer('focus', 60_000, 0);
    expect(pauseTimer({ ...idle, status: 'idle' }, 5_000).status).toBe('idle');
    expect(resumeTimer({ ...idle, status: 'finished', remainingMs: 0 }, 5_000).status).toBe(
      'finished',
    );
  });
});

describe('tickTimer', () => {
  it('chuyển sang finished khi hết giờ và giữ nguyên ở các lần sau', () => {
    const running = startTimer('focus', 60_000, 0);
    expect(tickTimer(running, 30_000).status).toBe('running');

    const finished = tickTimer(running, 60_000);
    expect(finished.status).toBe('finished');
    expect(finished.remainingMs).toBe(0);
    expect(tickTimer(finished, 90_000)).toBe(finished);
  });
});

describe('stopTimer', () => {
  it('đưa về trạng thái chờ với thời lượng ban đầu', () => {
    const timer = startTimer('chapter', 90_000, 0);
    const stopped = stopTimer(timer);
    expect(stopped.status).toBe('idle');
    expect(stopped.remainingMs).toBe(90_000);
    expect(stopped.startedAt).toBeNull();
  });
});

describe('nextPomodoroPhase', () => {
  it('hết phiên tập trung thì chuyển sang nghỉ', () => {
    const next = nextPomodoroPhase(startTimer('focus', 1, 0), 25, 5, 1_000);
    expect(next?.mode).toBe('break');
    expect(next?.durationMs).toBe(5 * 60_000);
    expect(next?.status).toBe('running');
  });

  it('hết giờ nghỉ thì quay lại phiên tập trung', () => {
    const next = nextPomodoroPhase(startTimer('break', 1, 0), 50, 10, 1_000);
    expect(next?.mode).toBe('focus');
    expect(next?.durationMs).toBe(50 * 60_000);
  });

  it('phiên đọc chương không tự chuyển pha', () => {
    expect(nextPomodoroPhase(startTimer('chapter', 1, 0), 25, 5, 1_000)).toBeNull();
  });
});

describe('formatTimer', () => {
  it('hiển thị mm:ss và làm tròn lên giây', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(65_000)).toBe('01:05');
    expect(formatTimer(61_500)).toBe('01:02');
    expect(formatTimer(90 * 60_000)).toBe('90:00');
    expect(formatTimer(-5_000)).toBe('00:00');
  });
});

describe('shouldAutoPause', () => {
  it('tự tạm dừng khi vượt ngưỡng không hoạt động', () => {
    expect(shouldAutoPause(0, 30_000, 60_000)).toBe(false);
    expect(shouldAutoPause(0, 60_000, 60_000)).toBe(true);
    expect(shouldAutoPause(0, 120_000)).toBe(true);
  });

  it('bỏ qua dữ liệu không hợp lệ', () => {
    expect(shouldAutoPause(Number.NaN, 60_000)).toBe(false);
    expect(shouldAutoPause(0, Number.NaN)).toBe(false);
  });
});
