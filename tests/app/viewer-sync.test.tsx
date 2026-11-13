// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { syncKey } from '../../src/core/sync/record';
import { loadSetting, saveProgress, saveSetting } from '../../src/storage/db';
import { SYNC_SETTING_KEY, syncTiming } from '../../src/viewer/hooks/useProgressSync';
import { docIdOf, freshEnvironment, openFile, renderApp, tab, tick, waitForReady } from './helpers';
import { emitStorageChange, registerPdf, type FakeChrome } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

const PAGES = ['Một.', 'Hai.', 'Ba.', 'Bốn.', 'Năm.'];
const original = { ...syncTiming };
let chromeApi: FakeChrome;

beforeEach(async () => {
  chromeApi = await freshEnvironment();
  syncTiming.debounceMs = 40;
});
afterEach(() => {
  cleanup();
  setLocale('vi');
  syncTiming.debounceMs = original.debounceMs;
  vi.restoreAllMocks();
});

const pLike = (area: FakeChrome['sync']) =>
  Object.keys(area.data).filter((key) => /^p:[0-9a-f]{32}$/.test(key));

describe.each(CATALOGS)('đồng bộ tiến độ ($code)', ({ code, text }) => {
  async function open(options: { enabled?: boolean; remote?: unknown; local?: boolean } = {}) {
    Object.defineProperty(navigator, 'language', {
      value: code === 'en' ? 'en-US' : 'vi-VN',
      configurable: true,
    });
    const file = registerPdf('sach.pdf', PAGES, []);
    const docId = await docIdOf('sach.pdf');
    const key = syncKey(docId) as string;
    if (options.enabled !== undefined) await saveSetting(SYNC_SETTING_KEY, options.enabled);
    if (options.remote !== undefined) chromeApi.sync.data[key] = options.remote;
    const view = renderApp();
    await openFile(view.container, file);
    await waitFor(() => expect(document.documentElement.lang).toBe(code));
    await waitForReady();
    await tick(60);
    return { docId, key };
  }
  const next = () => fireEvent.click(screen.getByLabelText(text.nextPage));
  const remote = (page: number, ahead = 5_000, pageCount = PAGES.length) => ({
    page,
    pageCount,
    updatedAt: Date.now() + ahead,
  });

  it('tắt mặc định: đổi trang không ghi gì vào sync', async () => {
    await open();
    next();
    await tick(150);
    expect(pLike(chromeApi.sync)).toEqual([]);
    expect(await loadSetting(SYNC_SETTING_KEY)).toBeNull();
  });

  it('bật công tắc trong Cài đặt: lưu cài đặt (ở IndexedDB, không đồng bộ) và ghi tiến độ', async () => {
    const { key } = await open();
    fireEvent.click(tab(text.settingsTab));
    fireEvent.click(await screen.findByRole('checkbox', { name: text.syncToggle }));
    await waitFor(async () => expect(await loadSetting(SYNC_SETTING_KEY)).toBe(true));
    expect(screen.getByText(text.syncHint)).toBeTruthy();

    next();
    await waitFor(() => expect(chromeApi.sync.data[key]).toBeDefined(), { timeout: 2000 });
    expect(chromeApi.sync.data[key]).toMatchObject({ page: 2, pageCount: PAGES.length });
  });

  it('giá trị đồng bộ chỉ có đúng page, pageCount, updatedAt; không lộ tên file, văn bản hay key AI', async () => {
    const { key } = await open({ enabled: true });
    chromeApi.local.data.aiApiKey = 'sk-test-secret';
    next();
    await waitFor(() => expect(chromeApi.sync.data[key]).toBeDefined(), { timeout: 2000 });
    const value = chromeApi.sync.data[key] as Record<string, unknown>;
    expect(Object.keys(value).sort()).toEqual(['page', 'pageCount', 'updatedAt']);
    const everything = JSON.stringify(chromeApi.sync.data);
    expect(everything).not.toMatch(/sach\.pdf|Một|Hai|sk-test-secret|ghi chú/);
    expect(Object.keys(chromeApi.sync.data).every((k) => /^p:[0-9a-f]{32}$/.test(k))).toBe(true);
  });

  it('debounce: nhiều lần đổi trang liên tiếp chỉ ghi một lần với trang cuối', async () => {
    syncTiming.debounceMs = 150;
    const { key } = await open({ enabled: true });
    next();
    next();
    next();
    await tick(40);
    expect(chromeApi.sync.data[key]).toBeUndefined();
    await waitFor(() => expect(chromeApi.sync.data[key]).toBeDefined(), { timeout: 3000 });
    expect(chromeApi.sync.data[key]).toMatchObject({ page: 4 });
    expect(chromeApi.sync.set).toHaveBeenCalledTimes(1);
  });

  it('ẩn tab thì ghi ngay phần còn chờ (không đợi hết debounce)', async () => {
    syncTiming.debounceMs = 60_000;
    const { key } = await open({ enabled: true });
    next();
    await tick(30);
    expect(chromeApi.sync.data[key]).toBeUndefined();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(chromeApi.sync.data[key]).toMatchObject({ page: 2 }));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('mở tài liệu có bản đồng bộ mới hơn và khác trang: báo, KHÔNG tự nhảy; bấm "Đến trang X" mới nhảy', async () => {
    await open({ enabled: true, remote: remote(4) });
    expect(await screen.findByText(text.syncNotice(4))).toBeTruthy();
    expect(screen.getByText(text.pageLabel(1, PAGES.length))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: text.syncNoticeGo(4) }));
    await waitFor(() => expect(screen.getByText(text.pageLabel(4, PAGES.length))).toBeTruthy());
    expect(screen.queryByText(text.syncNotice(4))).toBeNull();
  });

  it('không báo khi bản đồng bộ cũ hơn tiến độ trên máy này', async () => {
    Object.defineProperty(navigator, 'language', { value: 'vi-VN', configurable: true });
    registerPdf('sach.pdf', PAGES, []);
    const docId = await docIdOf('sach.pdf');
    await saveProgress(docId, 2, Date.now());
    await open({ enabled: true, remote: remote(4, -10 * 60_000) });
    await tick(80);
    expect(screen.queryByText(text.syncNotice(4))).toBeNull();
  });

  it('không báo khi cùng trang, khi bản đồng bộ hỏng, hoặc khi đồng bộ đang tắt', async () => {
    await open({ enabled: true, remote: remote(1) });
    await tick(80);
    expect(screen.queryByText(text.syncNotice(1))).toBeNull();
    cleanup();

    await open({ enabled: true, remote: { page: 'x' } });
    await tick(80);
    expect(document.querySelector('.sync-notice')).toBeNull();
    cleanup();

    await open({ enabled: false, remote: remote(4) });
    await tick(80);
    expect(screen.queryByText(text.syncNotice(4))).toBeNull();
  });

  it('cùng tài liệu đang mở được đọc tiếp ở máy khác: onChanged cập nhật thông báo, vẫn không tự nhảy', async () => {
    const { key } = await open({ enabled: true });
    expect(screen.queryByText(text.syncNotice(3))).toBeNull();
    await act(async () => emitStorageChange({ [key]: { newValue: remote(3) } }, 'sync'));
    expect(await screen.findByText(text.syncNotice(3))).toBeTruthy();
    expect(screen.getByText(text.pageLabel(1, PAGES.length))).toBeTruthy();

    await act(async () => emitStorageChange({ [key]: { newValue: remote(5, 9_000) } }, 'sync'));
    expect(await screen.findByText(text.syncNotice(5))).toBeTruthy();
    expect(screen.queryByText(text.syncNotice(3))).toBeNull();
  });

  it('onChanged của vùng khác hoặc của tài liệu khác bị bỏ qua', async () => {
    const { key } = await open({ enabled: true });
    await act(async () => emitStorageChange({ [key]: { newValue: remote(3) } }, 'local'));
    await act(async () =>
      emitStorageChange({ [`p:${'f'.repeat(32)}`]: { newValue: remote(3) } }, 'sync'),
    );
    await tick(50);
    expect(screen.queryByText(text.syncNotice(3))).toBeNull();
  });

  it('"Bỏ qua" ẩn thông báo và cùng một bản không hiện lại', async () => {
    const { key } = await open({ enabled: true });
    const value = remote(3);
    await act(async () => emitStorageChange({ [key]: { newValue: value } }, 'sync'));
    fireEvent.click(await screen.findByRole('button', { name: text.syncNoticeDismiss }));
    expect(screen.queryByText(text.syncNotice(3))).toBeNull();
    await act(async () => emitStorageChange({ [key]: { newValue: value } }, 'sync'));
    await tick(40);
    expect(screen.queryByText(text.syncNotice(3))).toBeNull();
  });

  it('tắt đồng bộ phải hỏi: "giữ" thì dữ liệu còn nguyên', async () => {
    const { key } = await open({ enabled: true, remote: remote(1, -5000) });
    chromeApi.sync.data.autoOpenPdf = true;
    fireEvent.click(tab(text.settingsTab));
    fireEvent.click(await screen.findByRole('checkbox', { name: text.syncToggle }));
    const dialog = await screen.findByRole('dialog', { name: text.syncDisableTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: text.syncDisableKeep }));
    await waitFor(async () => expect(await loadSetting(SYNC_SETTING_KEY)).toBe(false));
    expect(chromeApi.sync.data[key]).toBeDefined();
    expect(chromeApi.sync.data.autoOpenPdf).toBe(true);
  });

  it('tắt và xóa: chỉ xóa các khóa p:*, giữ autoOpenPdf; "Hủy" thì không đổi gì', async () => {
    const { key } = await open({ enabled: true, remote: remote(1, -5000) });
    chromeApi.sync.data.autoOpenPdf = true;
    chromeApi.sync.data[`p:${'e'.repeat(32)}`] = { page: 2, pageCount: 9, updatedAt: 1 };
    fireEvent.click(tab(text.settingsTab));
    const toggle = await screen.findByRole('checkbox', { name: text.syncToggle });

    fireEvent.click(toggle);
    let dialog = await screen.findByRole('dialog', { name: text.syncDisableTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: text.syncDisableCancel }));
    await tick(40);
    expect(await loadSetting(SYNC_SETTING_KEY)).toBe(true);
    expect(pLike(chromeApi.sync)).toHaveLength(2);

    fireEvent.click(toggle);
    dialog = await screen.findByRole('dialog', { name: text.syncDisableTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: text.syncDisableDelete }));
    await waitFor(() => expect(pLike(chromeApi.sync)).toEqual([]));
    expect(chromeApi.sync.data.autoOpenPdf).toBe(true);
    expect(chromeApi.sync.data[key]).toBeUndefined();
  });

  it('lỗi quota khi ghi: im lặng, không làm phiền việc đọc, thử lại sau', async () => {
    const { key } = await open({ enabled: true });
    chromeApi.sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'));
    next();
    await tick(200);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(text.pageLabel(2, PAGES.length))).toBeTruthy();
    expect(chromeApi.sync.data[key]).toBeUndefined();
  });
});

describe('môi trường không có chrome.storage.sync', () => {
  it('tính năng tự ẩn và không lỗi', async () => {
    Reflect.deleteProperty((globalThis.chrome as { storage: object }).storage, 'sync');
    const file = registerPdf('sach.pdf', PAGES, []);
    const view = renderApp();
    await openFile(view.container, file);
    await waitForReady();
    await tick(40);
    fireEvent.click(tab(viText.settingsTab));
    await tick(30);
    expect(screen.queryByRole('checkbox', { name: viText.syncToggle })).toBeNull();
    fireEvent.click(screen.getByLabelText(viText.nextPage));
    await tick(100);
    expect(screen.getByText(viText.pageLabel(2, PAGES.length))).toBeTruthy();
  });
});
