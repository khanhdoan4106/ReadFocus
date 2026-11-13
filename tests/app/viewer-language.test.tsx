// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../src/i18n/en';
import { getLocale, readMirroredPreference, setLocale } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { freshEnvironment, openFile, renderApp, seedAi, tab, tick, waitForReady } from './helpers';
import { aiCalls, fakeProvider, registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/core/llm', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getProvider: () => fakeProvider,
}));
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const PAGES = ['Xác suất đo mức độ chắc chắn.', 'Biến ngẫu nhiên.'];

beforeEach(async () => {
  await freshEnvironment();
});

afterEach(() => {
  cleanup();
  setLocale('vi');
});

describe('giao diện English', () => {
  it('đổi ngôn ngữ trong Cài đặt thì chữ đổi ngay, cả thanh công cụ và thanh bên', async () => {
    const { container } = renderApp();
    expect(screen.getByText(viText.emptyTitle)).toBeTruthy();

    await openFile(container, registerPdf('a.pdf', PAGES));
    await waitForReady();
    fireEvent.click(tab(viText.settingsTab));
    fireEvent.click(screen.getByLabelText(viText.languageEn));

    await waitFor(() => expect(screen.getByText(en.pageLabel(1, 2))).toBeTruthy());
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(tab(en.searchTab)).toBeTruthy();
    expect(screen.getByLabelText(en.nextPage)).toBeTruthy();
    expect(screen.queryByText(viText.searchTab)).toBeNull();
    // Nhãn của chính nhóm chọn ngôn ngữ cũng đổi.
    expect(screen.getByRole('radiogroup', { name: en.languageLabel })).toBeTruthy();
  });

  it('lựa chọn được giữ sau khi tải lại', async () => {
    const first = renderApp();
    await openFile(first.container, registerPdf('a.pdf', PAGES));
    await waitForReady();
    fireEvent.click(tab(viText.settingsTab));
    fireEvent.click(screen.getByLabelText(viText.languageEn));
    await waitFor(() => expect(getLocale()).toBe('en'));
    await tick(30);
    expect(readMirroredPreference()).toBe('en');

    // "Tải lại": bỏ viewer, đặt lại ngôn ngữ như lúc mới nạp mã, dựng lại viewer.
    cleanup();
    setLocale('vi');
    renderApp();
    expect(await screen.findByText(en.emptyTitle)).toBeTruthy();
    expect(getLocale()).toBe('en');
  });

  it('"Theo trình duyệt": trình duyệt không phải tiếng Việt thì dùng English', async () => {
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
    const { container } = renderApp();
    await openFile(container, registerPdf('a.pdf', PAGES));
    await waitForReady();
    // Chưa chọn gì và trình duyệt không phải tiếng Việt: chuyển sang English khi nạp xong cài đặt.
    await waitFor(() => expect(getLocale()).toBe('en'));
    fireEvent.click(tab(en.settingsTab));
    fireEvent.click(screen.getByLabelText(en.languageVi));
    await waitFor(() => expect(getLocale()).toBe('vi'));
    fireEvent.click(screen.getByLabelText(viText.languageAuto));
    await waitFor(() => expect(getLocale()).toBe('en'));
    expect(tab(en.searchTab)).toBeTruthy();
  });

  it('hộp thoại đồng ý và thông báo lỗi hiện bằng English', async () => {
    const chromeApi = await freshEnvironment();
    await seedAi(chromeApi, { consentGiven: false });
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    const { container } = renderApp();
    await openFile(container, registerPdf('a.pdf', PAGES));
    await waitForReady();
    await waitFor(() => expect(getLocale()).toBe('en'));

    fireEvent.click(tab(en.settingsTab));
    await waitFor(() =>
      expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
        'sk-test-key',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: en.aiTestConnection }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(en.aiConsentTitle);
    expect(dialog.textContent).toContain(en.aiConsentBody(en.aiProviders.openai));
  });

  it('ngôn ngữ AI "theo giao diện": giao diện English thì yêu cầu tóm tắt bằng English', async () => {
    const chromeApi = await freshEnvironment();
    await seedAi(chromeApi, { language: 'ui' });
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    const { container } = renderApp();
    await openFile(container, registerPdf('a.pdf', PAGES, [{ title: 'Intro', page: 1 }]));
    await waitForReady();
    await waitFor(() => expect(getLocale()).toBe('en'));
    await screen.findByRole('button', { name: /Intro/ });
    await tick(60);

    fireEvent.click(tab(en.summaryTab));
    fireEvent.click(await screen.findByRole('button', { name: en.summarizeCurrentSection }));
    await waitFor(() => expect(aiCalls).toHaveLength(1));
    expect(aiCalls[0]?.request.prompt).toContain('Output language: English.');

    aiCalls[0]?.resolve('{}');
  });
});
