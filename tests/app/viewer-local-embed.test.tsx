// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_MODEL_FILES, localModelFileUrl, type CacheLike } from '../../src/core/embed/local';
import { defaultAiSettings } from '../../src/core/llm/settings';
import { saveAiSettings, type KeyStore } from '../../src/storage/ai';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
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
import { registerPdf } from './mocks';

const local = vi.hoisted(() => ({
  urls: new Set<string>(),
  download: vi.fn(),
  embed: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());
vi.mock('../../src/viewer/local-embed', () => {
  const cache: CacheLike = {
    match: async (url) => (local.urls.has(url) ? new Response('x') : undefined),
    delete: async (url) => local.urls.delete(url),
  };
  return {
    localEmbed: { download: local.download, embed: local.embed, dispose: local.dispose },
    openModelCache: async () => cache,
  };
});

const BOOK = ['Xác suất đo mức độ chắc chắn.', 'Biến ngẫu nhiên rời rạc.', 'Phân phối chuẩn.'];
const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

const cacheModel = () => {
  for (const file of LOCAL_MODEL_FILES) local.urls.add(localModelFileUrl(file));
};

beforeEach(async () => {
  // happy-dom không có Worker; hook coi môi trường không có Worker là không hỗ trợ.
  vi.stubGlobal('Worker', class {});
  local.urls.clear();
  local.download.mockReset();
  local.embed.mockReset();
  local.dispose.mockReset();
  local.embed.mockImplementation(async (texts: readonly string[]) =>
    texts.map(() => Float32Array.of(1, 0, 0)),
  );
  fetchSpy.mockClear();
  await freshEnvironment();
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  setLocale('vi');
});

async function openReady(language: 'vi' | 'en') {
  Object.defineProperty(navigator, 'language', {
    value: language === 'en' ? 'en-US' : 'vi-VN',
    configurable: true,
  });
  const view = renderApp();
  await openFile(view.container, registerPdf('sach.pdf', BOOK, []));
  await waitFor(() => expect(document.documentElement.lang).toBe(language));
  await waitForReady();
  await tick(30);
  return view;
}

describe.each(CATALOGS)('embedding trên máy ($code)', ({ code, text }) => {
  it('tải model chỉ sau khi xác nhận; hộp xác nhận ghi dung lượng và nguồn', async () => {
    await openReady(code);
    fireEvent.click(tab(text.settingsTab));
    fireEvent.click(screen.getByRole('radio', { name: text.aiEmbedSourceLocal }));

    const open = await screen.findByRole('button', { name: /\d+ MB\)$/ });
    expect(open.textContent).toContain('129 MB');
    fireEvent.click(open);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('129 MB');
    expect(dialog.textContent).toContain('huggingface.co');
    expect(local.download).not.toHaveBeenCalled();

    // Để sau: không tải gì.
    fireEvent.click(within(dialog).getByRole('button', { name: text.localModelConfirmCancel }));
    expect(local.download).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Đồng ý: tải đúng một lần, xong thì hiện nút xoá.
    local.download.mockImplementation(
      async (_signal: AbortSignal, onProgress: (p: unknown) => void) => {
        onProgress({ loaded: 5, total: 10 });
        cacheModel();
      },
    );
    fireEvent.click(await screen.findByRole('button', { name: /\d+ MB\)$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^(Tải|Download) 129 MB$/ }));
    expect(await screen.findByText(text.localModelReady)).toBeTruthy();
    expect(local.download).toHaveBeenCalledTimes(1);
  });

  it('đã có model trong cache thì hiện "đã tải"; xoá model dọn cache', async () => {
    cacheModel();
    await openReady(code);
    fireEvent.click(tab(text.settingsTab));
    fireEvent.click(screen.getByRole('radio', { name: text.aiEmbedSourceLocal }));
    expect(await screen.findByText(text.localModelReady)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: text.localModelDelete }));
    await waitFor(() => expect(screen.queryByText(text.localModelReady)).toBeNull());
    expect(local.urls.size).toBe(0);
    expect(local.dispose).toHaveBeenCalled();
  });

  it('huỷ giữa chừng: báo đã huỷ, model chưa được lưu', async () => {
    await openReady(code);
    fireEvent.click(tab(text.settingsTab));
    fireEvent.click(screen.getByRole('radio', { name: text.aiEmbedSourceLocal }));
    local.download.mockImplementation(
      (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { code: 'cancelled' })),
          );
        }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /\d+ MB\)$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^(Tải|Download) 129 MB$/ }));
    fireEvent.click(await screen.findByRole('button', { name: text.localModelCancel }));
    expect(await screen.findByRole('button', { name: /\d+ MB\)$/ })).toBeTruthy();
    expect(screen.queryByText(text.localModelReady)).toBeNull();
  });

  it('chỉ mục và tìm theo ý nghĩa chạy trên máy với nhà cung cấp Anthropic, không gọi mạng', async () => {
    cacheModel();
    const chromeApi = await freshEnvironment();
    await seedAi(chromeApi);
    // Chọn Anthropic (không có API embeddings) và nguồn "Trên máy".
    await saveAiSettings(chromeApi.local as unknown as KeyStore, {
      ...defaultAiSettings(),
      providerId: 'anthropic',
      model: 'claude-test',
      embedModel: '',
      embedSource: 'local',
      baseUrl: '',
      saveKey: true,
      language: 'vi',
      consentGiven: true,
    });
    await openReady(code);
    chromeApi.permissionsRequest.mockClear();

    fireEvent.click(tab(text.searchTab));
    fireEvent.click(screen.getByLabelText(text.semanticToggle));
    expect(screen.queryByText(text.semanticUnsupported)).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: text.semanticBuild }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toBe(
      `${text.semanticConfirmTitle}${text.semanticConfirmBodyLocal(3)}${text.semanticConfirmAcceptLocal}${text.semanticConfirmCancel}`,
    );
    fireEvent.click(within(dialog).getByRole('button', { name: text.semanticConfirmAcceptLocal }));

    expect(await screen.findByText(text.semanticToggleHintLocal)).toBeTruthy();
    expect(local.embed).toHaveBeenCalled();
    expect(local.embed.mock.calls.every(([, kind]) => kind === 'passage')).toBe(true);

    fireEvent.input(screen.getByPlaceholderText(text.searchPlaceholder), {
      target: { value: 'xác suất' },
    });
    fireEvent.submit(screen.getByPlaceholderText(text.searchPlaceholder).closest('form')!);
    await waitFor(() =>
      expect(local.embed.mock.calls.some(([, kind]) => kind === 'query')).toBe(true),
    );

    // Không xin quyền host, không có request mạng nào.
    expect(chromeApi.permissionsRequest).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('chọn "Trên máy" nhưng chưa tải model: tab Tìm kiếm chỉ dẫn tải model, không gọi gì', async () => {
    const chromeApi = await freshEnvironment();
    await saveAiSettings(chromeApi.local as unknown as KeyStore, {
      ...defaultAiSettings(),
      providerId: 'openai',
      model: 'x',
      embedModel: '',
      embedSource: 'local',
      baseUrl: '',
      saveKey: true,
      language: 'vi',
      consentGiven: true,
    });
    await openReady(code);
    fireEvent.click(tab(text.searchTab));
    fireEvent.click(screen.getByLabelText(text.semanticToggle));
    expect(await screen.findByText(text.semanticModelMissing)).toBeTruthy();
    expect(local.embed).not.toHaveBeenCalled();
  });
});
