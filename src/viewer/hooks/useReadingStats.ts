import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type StateUpdater,
} from 'preact/hooks';
import { addReadingSample, MAX_ACTIVE_GAP_MS, type ReadingSpeed } from '../../core/reading-time';
import { emptyDayStats, type DayStats } from '../../core/stats';
import { addDailyReading, loadDayStats, loadRecentStats } from '../../storage/db';

type Input = {
  /** Có tài liệu đang mở và đọc được. */
  ready: boolean;
  pageNumber: number;
  pageWords: Record<number, number>;
  setSpeed: Dispatch<StateUpdater<ReadingSpeed>>;
};

export function useReadingStats({ ready, pageNumber, pageWords, setSpeed }: Input) {
  const [todayStats, setTodayStats] = useState<DayStats>(() => emptyDayStats());
  const [recentStats, setRecentStats] = useState<DayStats[]>([]);
  // Đồng hồ đọc: thời gian đang đọc trang hiện tại, chỉ cộng khi tab hiển thị.
  const clockRef = useRef<{ page: number; activeMs: number; lastTick: number | null }>({
    page: 1,
    activeMs: 0,
    lastTick: null,
  });
  // Số phút/trang đã đọc chờ ghi vào thống kê ngày.
  const statsPendingRef = useRef({ minutes: 0, pages: 0 });
  const refreshStats = useCallback(async () => {
    const [today, recent] = await Promise.all([loadDayStats(), loadRecentStats(7)]);
    setTodayStats(today);
    setRecentStats(recent);
  }, []);

  const flushStats = useCallback(async () => {
    const pending = statsPendingRef.current;
    if (pending.minutes < 0.01 && pending.pages === 0) return;
    statsPendingRef.current = { minutes: 0, pages: 0 };
    const today = await addDailyReading(pending.minutes, pending.pages);
    setTodayStats(today);
    setRecentStats(await loadRecentStats(7));
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  // Ghi thống kê định kỳ thay vì mỗi giây.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => void flushStats(), 30_000);
    return () => {
      clearInterval(id);
      void flushStats();
    };
  }, [ready, flushStats]);

  // Đồng hồ chỉ chạy khi tab hiển thị; khoảng nghỉ dài hơn 2 phút không được tính.
  useEffect(() => {
    if (!ready) return;
    const clock = clockRef.current;

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible') {
        clock.lastTick = null;
        return;
      }
      if (clock.lastTick === null) {
        clock.lastTick = now;
        return;
      }
      const delta = Math.min(Math.max(now - clock.lastTick, 0), MAX_ACTIVE_GAP_MS);
      clock.activeMs += delta;
      statsPendingRef.current.minutes += delta / 60_000;
      clock.lastTick = now;
    };

    const onVisibilityChange = () => {
      clock.lastTick = null;
      tick();
      if (document.visibilityState !== 'visible') void flushStats();
    };

    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    tick();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clock.lastTick = null;
    };
  }, [flushStats, ready]);

  // Rời trang thì chốt mẫu đọc của trang vừa xem để học tốc độ thực tế.
  useEffect(() => {
    const clock = clockRef.current;
    if (clock.page === pageNumber) return;

    const words = pageWords[clock.page] ?? 0;
    if (words > 0 && clock.activeMs > 0) {
      setSpeed((current) => addReadingSample(current, { words, activeMs: clock.activeMs }));
    }
    if (clock.activeMs >= 1000) statsPendingRef.current.pages += 1;

    clock.page = pageNumber;
    clock.activeMs = 0;
    clock.lastTick = document.visibilityState === 'visible' ? Date.now() : null;
  }, [pageNumber, pageWords]);

  /** Tài liệu mới: bỏ mẫu đọc của tài liệu trước, bắt đầu đo từ trang khôi phục. */
  const restartClock = useCallback((page: number) => {
    clockRef.current = {
      page,
      activeMs: 0,
      lastTick: document.visibilityState === 'visible' ? Date.now() : null,
    };
  }, []);

  /** Xoá toàn bộ dữ liệu: bỏ cả số liệu chờ ghi. */
  const reset = useCallback(() => {
    statsPendingRef.current = { minutes: 0, pages: 0 };
    setTodayStats(emptyDayStats());
    setRecentStats([]);
  }, []);

  return { today: todayStats, recent: recentStats, restartClock, reset };
}
