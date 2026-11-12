import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  clampBandHeight,
  clampMinutes,
  DEFAULT_BAND_HEIGHT,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  nextPomodoroPhase,
  pauseTimer,
  resumeTimer,
  shouldAutoPause,
  startTimer,
  stopTimer,
  tickTimer,
  timerRemaining,
  type FocusTimer,
  type TimerMode,
} from '../../core/focus';
import { vi } from '../../i18n/vi';
import { loadSetting, saveSetting } from '../../storage/db';

const IDLE_TIMER: FocusTimer = {
  mode: 'chapter',
  status: 'idle',
  durationMs: 0,
  remainingMs: 0,
  startedAt: null,
};

type Input = {
  showToast: (message: string) => void;
  /** Số phút ước tính của mục đang đọc; 0 khi chưa có. */
  chapterMinutes: number;
};

export function useFocusTimer({ showToast, chapterMinutes }: Input) {
  const [timer, setTimer] = useState<FocusTimer>(IDLE_TIMER);
  const [now, setNow] = useState(() => Date.now());
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [bandHeight, setBandHeight] = useState(DEFAULT_BAND_HEIGHT);
  const [bandTop, setBandTop] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const settingsReadyRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const bandHeightRef = useRef(bandHeight);
  bandHeightRef.current = bandHeight;

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const notify = useCallback((title: string, message: string) => {
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (chromeApi?.notifications) {
      try {
        void chromeApi.notifications.create({
          type: 'basic',
          iconUrl: chromeApi.runtime.getURL('icons/icon-128.png'),
          title,
          message,
        });
        return;
      } catch {
        // Chrome từ chối thông báo thì hiện ngay trong trang.
      }
    }
    showToast(`${title} — ${message}`);
  }, []);

  // Nạp thông số tập trung đã lưu.
  useEffect(() => {
    void Promise.all([
      loadSetting<unknown>('focusMinutes'),
      loadSetting<unknown>('breakMinutes'),
      loadSetting<unknown>('focusBandHeight'),
    ]).then(([focusValue, breakValue, bandValue]) => {
      if (typeof focusValue === 'number') setFocusMinutes(clampMinutes(focusValue));
      if (typeof breakValue === 'number') setBreakMinutes(clampMinutes(breakValue, 1, 60));
      if (typeof bandValue === 'number') setBandHeight(clampBandHeight(bandValue));
      settingsReadyRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!settingsReadyRef.current) return;
    void saveSetting('focusMinutes', focusMinutes);
    void saveSetting('breakMinutes', breakMinutes);
    void saveSetting('focusBandHeight', bandHeight);
  }, [focusMinutes, breakMinutes, bandHeight]);

  // Ghi nhận hoạt động để tự tạm dừng khi người dùng rời đi.
  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      'pointermove',
      'pointerdown',
      'keydown',
      'wheel',
      'scroll',
      'touchstart',
    ];
    for (const event of events) window.addEventListener(event, markActive, { passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, markActive);
    };
  }, [markActive]);

  // Hẹn giờ chạy theo đồng hồ thật; tab bị ẩn hoặc người dùng ngồi im thì tạm dừng.
  useEffect(() => {
    if (timer.status !== 'running') return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (
        document.visibilityState !== 'visible' ||
        shouldAutoPause(lastActivityRef.current, current)
      ) {
        setTimer((value) => pauseTimer(value, current));
        return;
      }
      setTimer((value) => tickTimer(value, current));
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timer.status]);

  const handleTimerFinished = useCallback(
    (mode: TimerMode) => {
      switch (mode) {
        case 'chapter':
          notify(vi.notifyChapterTitle, vi.notifyChapterBody);
          break;
        case 'focus':
          notify(vi.notifyFocusTitle, vi.notifyFocusBody);
          break;
        case 'break':
          notify(vi.notifyBreakTitle, vi.notifyBreakBody);
          break;
      }
    },
    [notify],
  );

  useEffect(() => {
    if (timer.status !== 'finished') return;
    const mode = timer.mode;
    handleTimerFinished(mode);
    if (mode === 'focus' || mode === 'break') {
      const next = nextPomodoroPhase(timer, focusMinutes, breakMinutes, Date.now());
      if (next !== null) setTimer(next);
    }
  }, [timer, focusMinutes, breakMinutes, handleTimerFinished]);

  // Dải sáng đi theo chuột khi bật chế độ tập trung.
  useEffect(() => {
    if (!focusMode) return;
    const onMove = (event: PointerEvent) => {
      const height = bandHeightRef.current;
      const top = event.clientY - height / 2;
      setBandTop(Math.min(Math.max(top, 0), Math.max(window.innerHeight - height, 0)));
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    setBandTop((top) => Math.min(Math.max(top, 0), Math.max(window.innerHeight - bandHeight, 0)));
  }, [bandHeight, focusMode]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const remainingTimerMs = timerRemaining(timer, now);

  const startChapterTimer = useCallback(() => {
    if (chapterMinutes <= 0) return;
    markActive();
    const current = Date.now();
    setNow(current);
    setTimer(startTimer('chapter', chapterMinutes * 60_000, current));
  }, [chapterMinutes, markActive]);

  const startPomodoroTimer = useCallback(() => {
    markActive();
    const current = Date.now();
    setNow(current);
    setTimer(startTimer('focus', clampMinutes(focusMinutes) * 60_000, current));
  }, [focusMinutes, markActive]);

  const toggleTimer = useCallback(() => {
    markActive();
    const current = Date.now();
    setNow(current);
    setTimer((value) => {
      if (value.status === 'running') return pauseTimer(value, current);
      if (value.status === 'paused') return resumeTimer(value, current);
      return startTimer('focus', clampMinutes(focusMinutes) * 60_000, current);
    });
  }, [focusMinutes, markActive]);

  const stopCurrentTimer = useCallback(() => {
    setTimer((value) => stopTimer(value));
    setNow(Date.now());
  }, []);

  const toggleFocusMode = useCallback(() => {
    if (focusMode) {
      setFocusMode(false);
      if (document.fullscreenElement !== null) {
        void document.exitFullscreen().catch(() => undefined);
      }
      return;
    }
    markActive();
    setBandTop(Math.max((window.innerHeight - bandHeightRef.current) / 2, 0));
    setFocusMode(true);
  }, [focusMode, markActive]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (typeof document.documentElement.requestFullscreen !== 'function') {
      showToast(vi.focusFullscreenFailed);
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => {
      showToast(vi.focusFullscreenFailed);
    });
  }, []);

  /** Dịch dải sáng lên/xuống bằng phím mũi tên, không ra ngoài cửa sổ. */
  const moveBand = useCallback((delta: number) => {
    setBandTop((top) =>
      Math.min(Math.max(top + delta, 0), Math.max(window.innerHeight - bandHeightRef.current, 0)),
    );
  }, []);

  return {
    timer,
    remainingMs: remainingTimerMs,
    focusMinutes,
    breakMinutes,
    bandHeight,
    bandTop,
    focusMode,
    fullscreen,
    setFocusMinutes,
    setBreakMinutes,
    setBandHeight,
    startChapterTimer,
    startPomodoroTimer,
    toggleTimer,
    stopTimer: stopCurrentTimer,
    toggleFocusMode,
    toggleFullscreen,
    moveBand,
  };
}
