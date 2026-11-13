// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { freshEnvironment, openFile, renderApp, seedAi, tab, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

beforeEach(async () => {
  await freshEnvironment();
});

afterEach(() => {
  cleanup();
  setLocale('vi');
});

/** Tên truy cập được của một điều khiển: aria-label, aria-labelledby, <label>, chữ, title, placeholder. */
function accessibleName(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label?.trim()) return label.trim();
  const by = element.getAttribute('aria-labelledby');
  if (by) {
    const text = by
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (text) return text;
  }
  const id = element.getAttribute('id');
  const forLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
  const wrapping = element.closest('label');
  const labelText = (forLabel ?? wrapping)?.textContent?.trim();
  if (labelText) return labelText;
  if (element instanceof HTMLButtonElement && element.textContent?.trim()) {
    return element.textContent.trim();
  }
  return (element.getAttribute('title') ?? element.getAttribute('placeholder') ?? '').trim();
}

function controls(root: ParentNode): Element[] {
  return [
    ...root.querySelectorAll(
      'button, input:not([type="hidden"]):not([hidden]), select, textarea, [role="button"], a[href]',
    ),
  ];
}

async function openReady(language: 'vi' | 'en') {
  Object.defineProperty(navigator, 'language', {
    value: language === 'en' ? 'en-US' : 'vi-VN',
    configurable: true,
  });
  const view = renderApp();
  await openFile(view.container, registerPdf('a.pdf', ['Nội dung một.', 'Nội dung hai.']));
  await waitForReady();
  await waitFor(() => expect(document.documentElement.lang).toBe(language));
  await tick(60);
  return view;
}

describe.each(CATALOGS)('trợ năng ($code)', ({ code, text }) => {
  it('mọi điều khiển ở thanh công cụ và từng tab thanh bên đều có tên, không có tabindex dương', async () => {
    const { container } = await openReady(code);
    const tabs = [
      text.tocTitle,
      text.summaryTab,
      text.askTab,
      text.flashTab,
      text.searchTab,
      text.focusTab,
      text.settingsTab,
    ];
    for (const name of tabs) {
      fireEvent.click(tab(name));
      await tick(10);
      const missing = controls(container)
        .filter((element) => !/[\p{L}\p{N}]/u.test(accessibleName(element)))
        .map((element) => element.outerHTML.slice(0, 120));
      expect(missing, `${code}/${name}`).toEqual([]);
      for (const element of container.querySelectorAll('[tabindex]')) {
        expect(Number(element.getAttribute('tabindex')), `${code}/${name}`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('thứ tự Tab theo thứ tự đọc: thanh công cụ, rồi nội dung, rồi thanh bên', async () => {
    const { container } = await openReady(code);
    const order = controls(container);
    const toolbarIndex = order.findIndex((el) => el.closest('.toolbar'));
    const lastToolbar = order.map((el) => Boolean(el.closest('.toolbar'))).lastIndexOf(true);
    const firstSidebar = order.findIndex((el) => el.closest('.sidebar'));
    expect(toolbarIndex).toBe(0);
    expect(lastToolbar).toBeLessThan(firstSidebar);
    // Nhóm điều khiển và nhóm tab có nhãn đọc được bằng đúng ngôn ngữ.
    expect(screen.getByRole('group', { name: text.toolbarLabel })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: text.sidebarLabel })).toBeTruthy();
  });

  it('nhóm lựa chọn (ngôn ngữ, giao diện, ngôn ngữ AI) có role radiogroup và nhãn', async () => {
    const { container } = await openReady(code);
    fireEvent.click(tab(text.settingsTab));
    for (const label of [text.languageLabel, text.themeTitle, text.aiLanguageLabel]) {
      expect(screen.getByRole('radiogroup', { name: label }), `${code}/${label}`).toBeTruthy();
    }
    for (const radio of container.querySelectorAll('input[type="radio"]')) {
      expect(accessibleName(radio)).not.toBe('');
    }
  });

  it('hộp thoại đồng ý: role dialog, aria-modal, tiêu đề nối đúng id, Tab bị giữ trong hộp', async () => {
    const chromeApi = await freshEnvironment();
    await seedAi(chromeApi, { consentGiven: false });
    const { container } = await openReady(code);
    fireEvent.click(tab(text.settingsTab));
    await waitFor(() =>
      expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
        'sk-test-key',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: text.aiTestConnection }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const titleId = dialog.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(titleId)?.textContent).toBe(text.aiConsentTitle);

    const inside = controls(dialog);
    expect(inside.length).toBeGreaterThanOrEqual(2);
    (inside[inside.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab' });
    expect(document.activeElement).toBe(inside[0]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(inside[inside.length - 1]);
  });

  it('chế độ tối: chọn "Tối" đặt data-theme=dark và giữ khi đổi ngôn ngữ', async () => {
    await openReady(code);
    fireEvent.click(tab(text.settingsTab));
    fireEvent.click(screen.getByLabelText(text.themeDark));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    const other = code === 'vi' ? 'en' : 'vi';
    fireEvent.click(screen.getByLabelText(other === 'en' ? 'English' : 'Tiếng Việt'));
    await waitFor(() => expect(document.documentElement.lang).toBe(other));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
