// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { freshEnvironment, openFile, renderApp, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const BOOK = ['Một.', 'Hai.', 'Ba.', 'Bốn.'];

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

describe.each(CATALOGS)('hàng tab thanh bên: phím ($code)', ({ code, text }) => {
  async function open() {
    Object.defineProperty(navigator, 'language', {
      value: code === 'en' ? 'en-US' : 'vi-VN',
      configurable: true,
    });
    const view = renderApp();
    await openFile(view.container, registerPdf('sach.pdf', BOOK, []));
    await waitFor(() => expect(document.documentElement.lang).toBe(code));
    await waitForReady();
    await tick(30);
    return view;
  }
  const tabs = () => screen.getAllByRole('tab');
  const selected = () => tabs().findIndex((x) => x.getAttribute('aria-selected') === 'true');

  it('chỉ tab đang chọn có tabindex=0', async () => {
    await open();
    expect(tabs()).toHaveLength(8);
    expect(tabs().map((x) => x.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
    ]);
    fireEvent.click(tabs()[3]!);
    expect(tabs().map((x) => x.getAttribute('tabindex'))).toEqual([
      '-1',
      '-1',
      '-1',
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
    ]);
  });

  it('←/→ chuyển tab, vòng đầu–cuối, focus theo tab; không đổi trang PDF', async () => {
    await open();
    const list = screen.getByRole('tablist');
    tabs()[0]!.focus();
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' });
    expect(selected()).toBe(1);
    expect(document.activeElement).toBe(tabs()[1]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(selected()).toBe(7); // vòng về cuối
    expect(document.activeElement).toBe(tabs()[7]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(selected()).toBe(0); // vòng về đầu
    expect(list.getAttribute('role')).toBe('tablist');
    expect(screen.getByText(text.pageLabel(1, 4))).toBeTruthy();
  });

  it('Home/End về tab đầu/cuối', async () => {
    await open();
    fireEvent.click(tabs()[3]!);
    tabs()[3]!.focus();
    fireEvent.keyDown(tabs()[3]!, { key: 'End' });
    expect(selected()).toBe(7);
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(selected()).toBe(0);
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it('focus ngoài hàng tab: ←/→ vẫn chuyển trang PDF', async () => {
    await open();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText(text.pageLabel(2, 4))).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByText(text.pageLabel(1, 4))).toBeTruthy());
    expect(selected()).toBe(0);
  });
});
