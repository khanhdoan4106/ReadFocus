// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vi as t } from '../../src/i18n/vi';
import { loadOcrPages, loadQa, loadSummariesForDoc } from '../../src/storage/db';
import {
  docIdOf,
  fetchSpy,
  freshEnvironment,
  openFile,
  renderApp,
  seedAi,
  tab,
  tick,
  waitForReady,
} from './helpers';
import {
  aiCalls,
  fakeProvider,
  ocrState,
  registerPdf,
  summaryJson,
  type FakeChrome,
} from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());
vi.mock('../../src/core/ocr/tesseract-engine', async () =>
  (await import('./mocks')).fakeOcrEngineModule(),
);
vi.mock('../../src/viewer/ocr', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  renderPageForOcr: async () => ({ image: new Blob(['x']), width: 100, height: 40 }),
}));
vi.mock('../../src/core/llm', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getProvider: () => fakeProvider,
}));

const TEXT_A = [
  'Xác suất đo mức độ chắc chắn của một sự kiện ngẫu nhiên trong thí nghiệm.',
  'Biến ngẫu nhiên gán một số cho mỗi kết quả của thí nghiệm.',
];
const OUTLINE_A = [{ title: 'Mở đầu', page: 1 }];
const TEXT_B = ['Tài liệu thứ hai nói về hình học phẳng.', 'Đường tròn và tam giác.'];

let chromeApi: FakeChrome;

beforeEach(async () => {
  chromeApi = await freshEnvironment();
  await seedAi(chromeApi);
});

afterEach(() => {
  cleanup();
});

async function openA() {
  const view = renderApp();
  await openFile(view.container, registerPdf('a.pdf', TEXT_A, OUTLINE_A));
  await waitForReady();
  await screen.findByRole('button', { name: /Mở đầu/ });
  // Chờ trích văn bản xong: nút tóm tắt chỉ bật khi mục có chữ.
  await tick(50);
  return view;
}

async function switchToB(container: Element) {
  await openFile(container, registerPdf('b.pdf', TEXT_B));
  await waitFor(() => expect(screen.getByText('b.pdf')).toBeTruthy());
  await tick(50);
}

describe('mở file khác khi việc nền đang chạy', () => {
  it('tóm tắt: xin quyền trước khi gọi AI, và kết quả về muộn không hiện và không được lưu', async () => {
    const view = await openA();
    fireEvent.click(tab(t.summaryTab));
    fireEvent.click(await screen.findByRole('button', { name: t.summarizeCurrentSection }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    // `permissions.request` chạy trước request AI, đúng origin của nhà cung cấp.
    expect(chromeApi.permissionsRequest).toHaveBeenCalledTimes(1);
    expect(chromeApi.permissionsRequest.mock.calls[0]?.[0]).toEqual({
      origins: ['https://api.openai.com/*'],
    });
    const pending = aiCalls[0];
    expect(pending?.signal?.aborted).toBe(false);

    await switchToB(view.container);
    // Việc cũ phải bị huỷ ngay khi mở file khác.
    expect(pending?.signal?.aborted).toBe(true);

    // Dù nhà cung cấp vẫn trả kết quả, kết quả đó không được hiện hay lưu.
    pending?.resolve(summaryJson('KẾT QUẢ CŨ'));
    await tick(80);

    fireEvent.click(tab(t.summaryTab));
    expect(screen.queryByText(/KẾT QUẢ CŨ/)).toBeNull();
    expect(await loadSummariesForDoc(await docIdOf('a.pdf'))).toHaveLength(0);
    expect(await loadSummariesForDoc(await docIdOf('b.pdf'))).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tóm tắt xong bình thường thì hiện kết quả và lưu cache theo tài liệu', async () => {
    await openA();
    fireEvent.click(tab(t.summaryTab));
    fireEvent.click(await screen.findByRole('button', { name: t.summarizeCurrentSection }));
    await waitFor(() => expect(aiCalls).toHaveLength(1));

    aiCalls[0]?.resolve(summaryJson('Tóm tắt về xác suất'));
    expect((await screen.findAllByText(/Tóm tắt về xác suất/)).length).toBeGreaterThan(0);
    const saved = await loadSummariesForDoc(await docIdOf('a.pdf'));
    expect(saved).toHaveLength(1);
    expect(saved[0]?.summary).toBe('Tóm tắt về xác suất');
  });

  it('hỏi đáp: câu trả lời về muộn của tài liệu cũ không hiện và không được lưu', async () => {
    const view = await openA();
    fireEvent.click(tab(t.askTab));
    fireEvent.input(screen.getByLabelText(t.askPlaceholder), {
      target: { value: 'Xác suất là gì?' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.askSubmit }));

    await waitFor(() => expect(aiCalls).toHaveLength(1));
    const pending = aiCalls[0];
    expect(pending?.request.prompt).toContain('Xác suất là gì?');

    await switchToB(view.container);
    expect(pending?.signal?.aborted).toBe(true);

    pending?.resolve(
      JSON.stringify({
        answer: 'CÂU TRẢ LỜI CŨ',
        citations: [{ page: 1, quote: 'Xác suất đo mức độ chắc chắn' }],
        found: true,
      }),
    );
    await tick(80);

    fireEvent.click(tab(t.askTab));
    expect(screen.queryByText(/CÂU TRẢ LỜI CŨ/)).toBeNull();
    expect(await loadQa(await docIdOf('a.pdf'))).toHaveLength(0);
    expect(await loadQa(await docIdOf('b.pdf'))).toHaveLength(0);
  });

  it('OCR: mở file khác thì dừng engine, bỏ báo cáo và không nạp chữ OCR vào tài liệu mới', async () => {
    const view = renderApp();
    // Hai trang scan (không có lớp chữ).
    await openFile(view.container, registerPdf('scan.pdf', ['', ''], []));
    await waitForReady();
    await tick(50);

    const start = await screen.findByRole('button', { name: t.ocrStart });
    fireEvent.click(start);
    await waitFor(() => expect(ocrState.pending.length).toBeGreaterThan(0));
    expect(ocrState.created).toBe(1);
    expect(ocrState.terminated).toBe(0);

    await openFile(view.container, registerPdf('b.pdf', TEXT_B));
    await waitFor(() => expect(screen.getByText('b.pdf')).toBeTruthy());

    // Engine bị dừng hẳn khi mở file khác; thanh tiến độ OCR biến mất.
    await waitFor(() => expect(ocrState.terminated).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText(/Đang nhận dạng/)).toBeNull();

    ocrState.pending[0]?.resolve({
      text: 'CHỮ OCR CŨ',
      confidence: 90,
      width: 100,
      height: 40,
      words: [{ text: 'CHỮ', confidence: 90, box: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
    });
    await tick(80);

    expect(screen.queryByText(/Đã nhận dạng/)).toBeNull();
    expect(screen.queryByText(t.ocrPageBadge)).toBeNull();
    expect(await loadOcrPages(await docIdOf('b.pdf'))).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
