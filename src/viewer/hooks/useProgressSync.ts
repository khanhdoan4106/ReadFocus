import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ProgressSyncEngine, type SyncArea } from '../../core/sync/engine';
import { remoteReadingAhead, syncKey } from '../../core/sync/record';
import { loadSetting, saveSetting } from '../../storage/db';

/** Khóa cài đặt (IndexedDB, KHÔNG đồng bộ) lưu công tắc đồng bộ. */
export const SYNC_SETTING_KEY = 'syncProgress';

/** Thời gian chờ sau lần đổi trang cuối trước khi ghi (đổi được trong test). */
export const syncTiming = { debounceMs: 10_000 };

type Input = {
  docId: string | null;
  pageNumber: number;
  totalPages: number;
  ready: boolean;
  /** Tiến độ trên máy này lúc mở tài liệu (để biết bản đồng bộ có mới hơn không). */
  openedProgress: { docId: string; page: number; updatedAt: number } | null;
  goToPage: (page: number) => void;
};

export type SyncNotice = { page: number; pageCount: number; updatedAt: number };

function syncArea(): SyncArea | null {
  if (typeof chrome === 'undefined') return null;
  return (chrome.storage?.sync as unknown as SyncArea | undefined) ?? null;
}

/**
 * Đồng bộ tiến độ đọc qua `chrome.storage.sync`. Tắt mặc định; môi trường không có
 * `chrome.storage.sync` thì `supported = false` và mọi thứ im lặng. Không bao giờ tự nhảy trang:
 * chỉ hiện thông báo "Trên máy khác bạn đã đọc tới trang X".
 */
export function useProgressSync({
  docId,
  pageNumber,
  totalPages,
  ready,
  openedProgress,
  goToPage,
}: Input) {
  const supported = syncArea() !== null;
  const [enabled, setEnabledState] = useState(false);
  // Công tắc đọc đồng bộ được (đặt ngay khi tắt) để việc dọn dẹp không ghi lại dữ liệu vừa xóa.
  const enabledRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [failing, setFailing] = useState(false);

  const engineRef = useRef<ProgressSyncEngine | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(0);
  // Trạng thái mới nhất để các listener (visibilitychange, onChanged) đọc không bị cũ.
  const latest = useRef({ docId, pageNumber, totalPages, ready, openedProgress });
  latest.current = { docId, pageNumber, totalPages, ready, openedProgress };
  const lastQueuedRef = useRef<{ docId: string; page: number } | null>(null);
  const localChangedAtRef = useRef(0);

  // Nạp công tắc đã lưu.
  useEffect(() => {
    if (!supported) return;
    void loadSetting<unknown>(SYNC_SETTING_KEY).then((value) => {
      enabledRef.current = value === true;
      setEnabledState(value === true);
      setLoaded(true);
    });
  }, [supported]);

  const engine = useCallback((): ProgressSyncEngine | null => {
    const area = syncArea();
    if (area === null) return null;
    engineRef.current ??= new ProgressSyncEngine(area);
    return engineRef.current;
  }, []);

  const flush = useCallback(async () => {
    const instance = engine();
    if (instance === null) return;
    const result = await instance.flush();
    setFailing(instance.isFailingPersistently());
    if (!result.ok && result.reason !== 'nothing') {
      // Lỗi hoặc hết hạn mức: im lặng thử lại sau, không làm phiền việc đọc.
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(
        () => void flush(),
        Math.max(1000, result.retryAt - Date.now()),
      );
    }
  }, [engine]);

  /** Xếp hàng trang hiện tại của tài liệu đang mở (nếu khác lần đã xếp) rồi ghi. */
  const queueCurrent = useCallback(
    (immediate: boolean) => {
      const state = latest.current;
      const instance = engine();
      if (instance === null || !state.ready || !state.docId || state.totalPages < 1) return;
      const last = lastQueuedRef.current;
      if (last && last.docId === state.docId && last.page === state.pageNumber) return;
      const queued = instance.queue(state.docId, {
        page: Math.min(state.pageNumber, state.totalPages),
        pageCount: state.totalPages,
        updatedAt: Date.now(),
      });
      if (!queued) return;
      lastQueuedRef.current = { docId: state.docId, page: state.pageNumber };
      if (immediate) void flush();
    },
    [engine, flush],
  );

  // Ghi sau ~10 giây kể từ lần đổi trang cuối.
  useEffect(() => {
    if (!enabled || !supported || !ready || !docId) return;
    // Trang đầu tiên (khôi phục lúc mở) không phải là thay đổi của người dùng.
    if (openedProgress?.docId === docId && openedProgress.page === pageNumber) return;
    localChangedAtRef.current = Date.now();
    const timer = setTimeout(() => queueCurrent(true), syncTiming.debounceMs);
    return () => clearTimeout(timer);
  }, [enabled, supported, ready, docId, pageNumber, openedProgress, queueCurrent]);

  // Ẩn tab hoặc đóng: ghi ngay phần còn chờ.
  useEffect(() => {
    if (!enabled || !supported) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') queueCurrent(true);
    };
    const onPageHide = () => queueCurrent(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      // Đổi tài liệu: ghi nốt. Tắt công tắc thì KHÔNG ghi (người dùng có thể vừa chọn xóa dữ liệu).
      if (enabledRef.current) queueCurrent(true);
    };
  }, [enabled, supported, queueCurrent]);

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
    },
    [],
  );

  /** Bản đồng bộ có đáng báo không, so với trang đang đọc và mốc thay đổi gần nhất trên máy này. */
  const evaluate = useCallback((remote: unknown) => {
    const state = latest.current;
    if (!state.docId || !state.ready) return;
    const opened = state.openedProgress?.docId === state.docId ? state.openedProgress : null;
    const localUpdatedAt = Math.max(opened?.updatedAt ?? 0, localChangedAtRef.current);
    const ahead = remoteReadingAhead(
      { page: state.pageNumber, updatedAt: localUpdatedAt },
      remote,
      Date.now(),
    );
    if (ahead === null || ahead.updatedAt <= dismissedRef.current) {
      setNotice(null);
      return;
    }
    // Chỉ báo trang còn nằm trong tài liệu này.
    setNotice(
      ahead.page <= state.totalPages
        ? { page: ahead.page, pageCount: ahead.pageCount, updatedAt: ahead.updatedAt }
        : null,
    );
  }, []);

  // Khi mở tài liệu: đọc bản đồng bộ.
  useEffect(() => {
    setNotice(null);
    dismissedRef.current = 0;
    localChangedAtRef.current = 0;
    lastQueuedRef.current = null;
    if (!enabled || !supported || !ready || !docId || !openedProgress) return;
    if (openedProgress.docId !== docId) return;
    const instance = engine();
    if (instance === null) return;
    let active = true;
    void instance.read(docId).then((remote) => {
      if (active) evaluate(remote);
    });
    return () => {
      active = false;
    };
  }, [enabled, supported, ready, docId, openedProgress, engine, evaluate]);

  // Cùng tài liệu được đọc tiếp ở máy khác: cập nhật thông báo (cũng không tự nhảy).
  useEffect(() => {
    if (!enabled || !supported || typeof chrome === 'undefined') return;
    const onChanged = chrome.storage?.onChanged;
    if (!onChanged) return;
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      const key = latest.current.docId ? syncKey(latest.current.docId) : null;
      if (area !== 'sync' || key === null || !(key in changes)) return;
      evaluate(changes[key]?.newValue);
    };
    onChanged.addListener(listener as never);
    return () => onChanged.removeListener(listener as never);
  }, [enabled, supported, evaluate]);

  // Người dùng tự tới đúng trang đó thì thông báo hết cần thiết.
  useEffect(() => {
    if (notice !== null && notice.page === pageNumber) setNotice(null);
  }, [notice, pageNumber]);

  const enable = useCallback(() => {
    enabledRef.current = true;
    setEnabledState(true);
    void saveSetting(SYNC_SETTING_KEY, true);
  }, []);

  /** Tắt đồng bộ; `deleteData` xoá CHỈ các khóa `p:*` đã đồng bộ. Trả số khóa đã xoá. */
  const disable = useCallback(
    async (deleteData: boolean): Promise<number> => {
      enabledRef.current = false;
      setEnabledState(false);
      setNotice(null);
      setFailing(false);
      void saveSetting(SYNC_SETTING_KEY, false);
      if (!deleteData) return 0;
      return (await engine()?.clearSynced()) ?? 0;
    },
    [engine],
  );

  const goToNoticePage = useCallback(() => {
    if (notice === null) return;
    goToPage(notice.page);
    setNotice(null);
  }, [notice, goToPage]);

  const dismissNotice = useCallback(() => {
    if (notice !== null) dismissedRef.current = notice.updatedAt;
    setNotice(null);
  }, [notice]);

  return {
    supported,
    /** Đã nạp công tắc (tránh nhấp nháy trong Cài đặt). */
    loaded,
    enabled,
    failing,
    notice,
    enable,
    disable,
    goToNoticePage,
    dismissNotice,
  };
}

export type ProgressSyncApi = ReturnType<typeof useProgressSync>;
