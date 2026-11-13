import { expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { _resetDbForTest } from '../../src/storage/db';
import { App } from '../../src/viewer/App';
import { saveAiSettings, saveApiKey, type KeyStore } from '../../src/storage/ai';
import { defaultAiSettings } from '../../src/core/llm/settings';
import { sha256Hex } from '../../src/core/hash';
import { setLocale } from '../../src/i18n';
import { installChrome, resetMocks, type FakeChrome } from './mocks';

/** Mọi lời gọi `fetch` của viewer; test AI dùng provider giả nên danh sách này phải rỗng. */
export const fetchSpy = vi.fn(async (): Promise<Response> => {
  throw new Error('test không được gọi mạng thật');
});

/** Id tài liệu mà viewer tính cho file giả (băm tên file). */
export async function docIdOf(name: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(name).buffer as ArrayBuffer);
}

export async function resetDatabase(): Promise<void> {
  _resetDbForTest();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('readfocus');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Môi trường sạch cho mỗi test: IndexedDB, chrome.*, đồ giả, localStorage. */
export async function freshEnvironment(): Promise<FakeChrome> {
  resetMocks();
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
  await resetDatabase();
  document.documentElement.removeAttribute('data-theme');
  // Trình duyệt tiếng Việt, chưa chọn ngôn ngữ: giao diện tiếng Việt như mặc định của người dùng Việt.
  Object.defineProperty(navigator, 'language', { value: 'vi-VN', configurable: true });
  localStorage.clear();
  setLocale('vi');
  // happy-dom không có Fullscreen API.
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  return installChrome();
}

/** Cấu hình AI đã đồng ý và có key, để các luồng AI chạy thẳng không hỏi lại. */
export async function seedAi(
  chromeApi: FakeChrome,
  overrides: { consentGiven?: boolean; language?: 'vi' | 'en' | 'document' | 'ui' } = {},
) {
  await saveAiSettings(chromeApi.local as unknown as KeyStore, {
    ...defaultAiSettings(),
    consentGiven: overrides.consentGiven ?? true,
    language: overrides.language ?? 'vi',
  });
  await saveApiKey(chromeApi.local as unknown as KeyStore, 'sk-test-key');
}

export function renderApp() {
  return render(h(App, {}));
}

export async function openFile(container: Element, file: File): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('không thấy ô chọn file');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

/** Chờ tới khi viewer báo `ready` (có khung trang) và lập chỉ mục xong. */
export async function waitForReady(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId('page-list')).toBeTruthy());
}

export function tab(name: string): HTMLElement {
  return screen.getByRole('tab', { name });
}

export async function tick(ms = 0): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
