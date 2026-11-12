// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../src/core/hash';
import { vi as t } from '../../src/i18n/vi';
import {
  fetchSpy,
  freshEnvironment,
  openFile,
  renderApp,
  seedAi,
  tab,
  tick,
  waitForReady,
} from './helpers';
import { aiCalls, fakeProvider, registerPdf, summaryJson, type FakeChrome } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());
vi.mock('../../src/core/llm', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getProvider: () => fakeProvider,
}));

/**
 * Đặc tả hành vi tổng hợp: chạy một kịch bản cố định rồi ghi lại (1) request ra ngoài,
 * (2) key đã ghi vào IndexedDB và chrome.storage, (3) chữ hiển thị sau từng bước.
 * Snapshot được tạo từ code TRƯỚC khi tách `App.tsx` và phải giữ nguyên sau khi tách
 * (mục 12 của danh sách rà soát: không đổi hành vi).
 */

const PAGES = [
  'Xác suất đo mức độ chắc chắn của một sự kiện ngẫu nhiên trong thí nghiệm.',
  'Biến ngẫu nhiên gán một số cho mỗi kết quả của thí nghiệm.',
  'Phân phối chuẩn xuất hiện ở khắp nơi trong thống kê ứng dụng.',
];
const OUTLINE = [
  { title: 'Mở đầu', page: 1 },
  { title: 'Phân phối', page: 3 },
];

let chromeApi: FakeChrome;

beforeEach(async () => {
  chromeApi = await freshEnvironment();
  await seedAi(chromeApi);
});

afterEach(() => {
  cleanup();
});

function screenText(): string {
  return (document.body.textContent ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')
    .trim();
}

function normalizeKey(key: unknown): string {
  return JSON.stringify(key)
    .replace(/\d{10,}/g, 'N')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID');
}

async function dumpIndexedDb(): Promise<Record<string, string[]>> {
  const db = await openDB('readfocus');
  const result: Record<string, string[]> = {};
  for (const store of [...db.objectStoreNames].sort()) {
    const keys = await db.getAllKeys(store);
    result[store] = keys.map(normalizeKey).sort();
  }
  db.close();
  return result;
}

async function digest(text: string): Promise<string> {
  return (await sha256Hex(new TextEncoder().encode(text).buffer as ArrayBuffer)).slice(0, 12);
}

describe('kịch bản hành vi tổng hợp của viewer', () => {
  it('request, key đã ghi và chữ hiển thị giữ nguyên qua mọi lần tách mã', async () => {
    const screens: Record<string, string> = {};
    const view = renderApp();

    // 1. Mở file.
    await openFile(view.container, registerPdf('a.pdf', PAGES, OUTLINE));
    await waitForReady();
    await screen.findByRole('button', { name: /Phân phối/ });
    await tick(80);
    screens['1-mở-file'] = screenText();

    // 2. Tìm kiếm rồi bấm kết quả.
    fireEvent.click(tab(t.searchTab));
    await waitFor(() => expect(screen.queryByText(t.searchNotReady)).toBeNull());
    fireEvent.input(screen.getByLabelText(t.searchPlaceholder), { target: { value: 'sự kiện' } });
    fireEvent.click(await screen.findByRole('button', { name: /sự kiện/ }));
    await tick(30);
    screens['2-tìm-kiếm'] = screenText();

    // 3. Tóm tắt mục đang đọc (mục 1 ở trang 1).
    fireEvent.click(tab(t.tocTitle));
    fireEvent.click(await screen.findByRole('button', { name: /Mở đầu/ }));
    fireEvent.click(tab(t.summaryTab));
    fireEvent.click(await screen.findByRole('button', { name: t.summarizeCurrentSection }));
    await waitFor(() => expect(aiCalls).toHaveLength(1));
    aiCalls[0]?.resolve(summaryJson('Xác suất đo mức độ chắc chắn'));
    await screen.findAllByText(/Xác suất đo mức độ chắc chắn/);
    await tick(80);
    screens['3-tóm-tắt'] = screenText();

    // 4. Thẻ ôn tập từ bản tóm tắt.
    fireEvent.click(tab(t.flashTab));
    fireEvent.click(await screen.findByRole('button', { name: t.flashFromSummaries }));
    await tick(120);
    screens['4-thẻ-ôn-tập'] = screenText();

    // 5. Hỏi đáp có trích dẫn.
    fireEvent.click(tab(t.askTab));
    fireEvent.input(screen.getByLabelText(t.askPlaceholder), {
      target: { value: 'Xác suất là gì?' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.askSubmit }));
    await waitFor(() => expect(aiCalls).toHaveLength(2));
    aiCalls[1]?.resolve(
      JSON.stringify({
        answer: 'Xác suất đo mức độ chắc chắn.',
        citations: [{ page: 1, quote: 'Xác suất đo mức độ chắc chắn' }],
        found: true,
      }),
    );
    await screen.findByText(/Xác suất đo mức độ chắc chắn\./);
    await tick(80);
    screens['5-hỏi-đáp'] = screenText();

    // 6. Đổi giao diện sang tối.
    fireEvent.click(tab(t.settingsTab));
    fireEvent.click(screen.getByLabelText(t.themeDark));
    await tick(50);
    const theme = document.documentElement.dataset.theme;
    screens['6-cài-đặt'] = screenText();

    const providerCalls = await Promise.all(
      aiCalls.map(async (call) => ({
        model: call.request.model,
        maxTokens: call.request.maxTokens ?? null,
        systemHash: await digest(call.request.system),
        promptHash: await digest(call.request.prompt),
      })),
    );

    const storage = (area: FakeChrome['local']) => Object.keys(area.data).sort();

    expect({
      requests: {
        fetch: fetchSpy.mock.calls.length,
        permissions: chromeApi.permissionsRequest.mock.calls.map((call) => call[0]),
        providerCalls,
      },
      writes: {
        indexedDb: await dumpIndexedDb(),
        chromeStorage: {
          local: storage(chromeApi.local),
          session: storage(chromeApi.session),
          sync: storage(chromeApi.sync),
        },
        theme,
      },
      screens,
    }).toMatchSnapshot();
  });
});
