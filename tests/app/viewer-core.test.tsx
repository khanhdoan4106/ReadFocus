// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vi as t } from '../../src/i18n/vi';
import { freshEnvironment, openFile, renderApp, seedAi, tab, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const BOOK = [
  'Giới thiệu về xác suất. Xác suất đo mức độ chắc chắn.',
  'Biến ngẫu nhiên rời rạc và liên tục.',
  'Phân phối chuẩn xuất hiện ở khắp nơi trong thống kê.',
  'Kết luận: xác suất giúp ra quyết định.',
];
const OUTLINE = [
  { title: 'Mở đầu', page: 1 },
  { title: 'Biến ngẫu nhiên', page: 2 },
  { title: 'Kết luận', page: 4 },
];

beforeEach(async () => {
  await freshEnvironment();
});

afterEach(() => {
  cleanup();
});

describe('viewer: mở file, mục lục, tìm kiếm', () => {
  it('chưa mở file thì hiện màn hình trống; mở file thì hiện trang và tổng số trang', async () => {
    const { container } = renderApp();
    expect(screen.getByText(t.emptyTitle)).toBeTruthy();

    await openFile(container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    expect(screen.getByText('sach.pdf')).toBeTruthy();
    expect(screen.getByText(t.pageLabel(1, 4))).toBeTruthy();
    expect(screen.queryByText(t.emptyTitle)).toBeNull();
  });

  it('mục lục dựng từ outline; bấm một mục thì nhảy tới trang của mục đó', async () => {
    const { container } = renderApp();
    await openFile(container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    const item = await screen.findByRole('button', { name: /Kết luận/ });
    fireEvent.click(item);

    await waitFor(() => expect(screen.getByText(t.pageLabel(4, 4))).toBeTruthy());
    const input = screen.getByLabelText(t.pageInputLabel) as HTMLInputElement;
    expect(input.value).toBe('4');
  });

  it('nút trang sau, trang trước và ô nhập số trang đổi đúng trang', async () => {
    const { container } = renderApp();
    await openFile(container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    fireEvent.click(screen.getByLabelText(t.nextPage));
    await waitFor(() => expect(screen.getByText(t.pageLabel(2, 4))).toBeTruthy());

    const input = screen.getByLabelText(t.pageInputLabel) as HTMLInputElement;
    fireEvent.input(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(t.pageLabel(3, 4))).toBeTruthy());

    fireEvent.click(screen.getByLabelText(t.previousPage));
    await waitFor(() => expect(screen.getByText(t.pageLabel(2, 4))).toBeTruthy());
  });

  it('tìm kiếm trả kết quả đúng trang; bấm kết quả nhảy tới trang và tô chữ', async () => {
    const { container } = renderApp();
    await openFile(container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    fireEvent.click(tab(t.searchTab));
    const box = screen.getByLabelText(t.searchPlaceholder);
    // Chờ chỉ mục dựng xong (trước đó ô tìm hiện "chưa sẵn sàng").
    await waitFor(() => expect(screen.queryByText(t.searchNotReady)).toBeNull());
    fireEvent.input(box, { target: { value: 'phân phối chuẩn' } });

    const result = await screen.findByRole('button', { name: /Phân phối chuẩn/ });
    expect(screen.getByText(t.searchResultCount(1))).toBeTruthy();
    fireEvent.click(result);

    await waitFor(() => expect(screen.getByText(t.pageLabel(3, 4))).toBeTruthy());
    expect(screen.getByTestId('highlight').textContent).toBe('3:phân phối chuẩn');
  });

  it('tìm không thấy thì báo không có kết quả', async () => {
    const { container } = renderApp();
    await openFile(container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    fireEvent.click(tab(t.searchTab));
    await waitFor(() => expect(screen.queryByText(t.searchNotReady)).toBeNull());
    fireEvent.input(screen.getByLabelText(t.searchPlaceholder), { target: { value: 'zzzqqq' } });
    expect(await screen.findByText(t.searchNoResults('zzzqqq'))).toBeTruthy();
  });

  it('đổi tab thanh bên: mỗi lần chỉ một tab được chọn và hiện đúng bảng', async () => {
    const { container } = renderApp();
    await openFile(container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    const names = [
      t.tocTitle,
      t.summaryTab,
      t.askTab,
      t.flashTab,
      t.searchTab,
      t.focusTab,
      t.settingsTab,
    ];
    for (const name of names) {
      fireEvent.click(tab(name));
      expect(tab(name).getAttribute('aria-selected')).toBe('true');
      expect(
        screen.getAllByRole('tab').filter((e) => e.getAttribute('aria-selected') === 'true'),
      ).toHaveLength(1);
      expect(screen.getByRole('tabpanel').getAttribute('aria-label')).toBe(name);
    }
  });

  it('file không hợp lệ thì báo lỗi và cho chọn lại', async () => {
    const { container } = renderApp();
    // Không đăng ký PDF nào: `openPdfData` giả trả lỗi `invalid`.
    await openFile(container, new File(['x'], 'hong.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(t.errorInvalid)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.retry })).toBeTruthy();
  });
});

describe('viewer: phím tắt và hộp thoại', () => {
  async function openReady() {
    const view = renderApp();
    await openFile(view.container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();
    await tick(30); // để Preact gắn xong các effect (bộ lắng nghe phím)
    return view;
  }

  it('phím ←/→ đổi trang, T đóng mở thanh bên, F bật chế độ tập trung và Esc thoát', async () => {
    await openReady();

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText(t.pageLabel(2, 4))).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByText(t.pageLabel(1, 4))).toBeTruthy());

    expect(screen.queryByRole('tablist')).not.toBeNull();
    fireEvent.keyDown(document.body, { key: 't' });
    await waitFor(() => expect(screen.queryByRole('tablist')).toBeNull());
    fireEvent.keyDown(document.body, { key: 't' });
    await waitFor(() => expect(screen.queryByRole('tablist')).not.toBeNull());

    fireEvent.keyDown(document.body, { key: 'f' });
    expect(await screen.findByRole('group', { name: t.focusModeTitle })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('group', { name: t.focusModeTitle })).toBeNull());
  });

  it('phím tắt không chạy khi đang gõ trong ô nhập', async () => {
    await openReady();
    fireEvent.click(tab(t.searchTab));
    const box = screen.getByLabelText(t.searchPlaceholder);
    box.focus();

    fireEvent.keyDown(box, { key: 'ArrowRight' });
    fireEvent.keyDown(box, { key: 'f' });
    fireEvent.keyDown(box, { key: 't' });

    expect(screen.getByText(t.pageLabel(1, 4))).toBeTruthy();
    expect(screen.queryByRole('group', { name: t.focusModeTitle })).toBeNull();
    expect(screen.queryByRole('tablist')).not.toBeNull();
  });

  it('phím tắt không chạy khi hộp thoại đang mở; Esc đóng hộp thoại và trả focus', async () => {
    const chromeApi = await freshEnvironment();
    await seedAi(chromeApi, { consentGiven: false });
    const view = renderApp();
    await openFile(view.container, registerPdf('sach.pdf', BOOK, OUTLINE));
    await waitForReady();

    // Hộp đồng ý hiện khi kiểm tra kết nối lần đầu.
    fireEvent.click(tab(t.settingsTab));
    const test = await screen.findByRole('button', { name: t.aiTestConnection });
    await waitFor(() =>
      expect(view.container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
        'sk-test-key',
      ),
    );
    test.focus();
    fireEvent.click(test);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(t.aiConsentTitle)).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'f' });
    expect(screen.getByText(t.pageLabel(1, 4))).toBeTruthy();
    expect(screen.queryByRole('group', { name: t.focusModeTitle })).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(test);
  });

  it('hẹn giờ: bắt đầu phiên tập trung hiện nút hẹn giờ trên thanh công cụ; Space tạm dừng và chạy tiếp; Dừng thì ẩn', async () => {
    await openReady();
    fireEvent.click(tab(t.focusTab));
    expect(screen.queryByText(t.timerModeFocus, { selector: '.toolbar__timer-mode' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t.pomodoroStart }));
    const mode = await screen.findByText(t.timerModeFocus, { selector: '.toolbar__timer-mode' });
    expect(mode).toBeTruthy();
    const toggle = mode.closest('button') as HTMLElement;
    expect(toggle.getAttribute('aria-label')).toBe(t.timerToggleAria(t.timerModeFocus, '25:00'));
    expect(toggle.className).not.toContain('toolbar__timer--paused');

    fireEvent.keyDown(document.body, { key: ' ' });
    await waitFor(() => expect(toggle.className).toContain('toolbar__timer--paused'));
    fireEvent.keyDown(document.body, { key: ' ' });
    await waitFor(() => expect(toggle.className).not.toContain('toolbar__timer--paused'));

    fireEvent.click(screen.getByRole('button', { name: t.timerStop }));
    await waitFor(() =>
      expect(screen.queryByText(t.timerModeFocus, { selector: '.toolbar__timer-mode' })).toBeNull(),
    );
  });
});
