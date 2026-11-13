import { describe, expect, it } from 'vitest';
import { embedBatch } from '../src/core/embed/api';
import {
  createProgressTracker,
  deleteModelFiles,
  isModelCached,
  LOCAL_MODEL_BYTES,
  LOCAL_MODEL_FILES,
  LOCAL_MODEL_ID,
  LOCAL_MODEL_REVISION,
  localModelFileUrl,
  type CacheLike,
} from '../src/core/embed/local';
import { embedKey, embedPrefix, resolveEmbedSource } from '../src/core/embed/models';
import { defaultAiSettings, sanitizeAiSettings } from '../src/core/llm/settings';

function fakeCache(initial: readonly string[]): CacheLike & { urls: Set<string> } {
  const urls = new Set(initial);
  return {
    urls,
    match: async (url) => (urls.has(url) ? new Response('x') : undefined),
    delete: async (url) => urls.delete(url),
  };
}

const ALL_URLS = LOCAL_MODEL_FILES.map(localModelFileUrl);

describe('model chạy trên máy: hằng số', () => {
  it('ghim commit và trỏ tới Hugging Face', () => {
    expect(LOCAL_MODEL_REVISION).toMatch(/^[0-9a-f]{40}$/);
    for (const url of ALL_URLS) {
      expect(url.startsWith(`https://huggingface.co/${LOCAL_MODEL_ID}/resolve/`)).toBe(true);
    }
  });

  it('tổng dung lượng khoảng 129 MiB (model 8 bit + tokenizer)', () => {
    expect(LOCAL_MODEL_BYTES).toBe(135_392_016);
  });

  it('dùng tiền tố query:/passage: đúng thẻ model', () => {
    expect(embedPrefix(LOCAL_MODEL_ID, 'query')).toBe('query: ');
    expect(embedPrefix(LOCAL_MODEL_ID, 'passage')).toBe('passage: ');
  });
});

describe('cache của model', () => {
  it('chỉ coi là đã tải khi đủ mọi file', async () => {
    expect(await isModelCached(fakeCache([]))).toBe(false);
    expect(await isModelCached(fakeCache(ALL_URLS.slice(1)))).toBe(false);
    expect(await isModelCached(fakeCache(ALL_URLS))).toBe(true);
  });

  it('xoá model chỉ xoá file của model, giữ mục khác trong cache', async () => {
    const other = 'https://huggingface.co/other/model/resolve/main/config.json';
    const cache = fakeCache([...ALL_URLS, other]);
    expect(await deleteModelFiles(cache)).toBe(LOCAL_MODEL_FILES.length);
    expect([...cache.urls]).toEqual([other]);
    expect(await isModelCached(cache)).toBe(false);
  });
});

describe('createProgressTracker', () => {
  const [model, tokenizer] = LOCAL_MODEL_FILES;

  it('gộp tiến độ nhiều file, tổng cố định nên không nhảy lùi', () => {
    const tracker = createProgressTracker();
    expect(tracker.current()).toEqual({ loaded: 0, total: LOCAL_MODEL_BYTES });
    tracker.update({ status: 'progress', file: model?.path, loaded: 1000, total: model?.bytes });
    const mid = tracker.update({
      status: 'progress',
      file: tokenizer?.path,
      loaded: 500,
      total: tokenizer?.bytes,
    });
    expect(mid).toEqual({ loaded: 1500, total: LOCAL_MODEL_BYTES });
  });

  it('done tính đủ file; bỏ qua sự kiện lạ và file ngoài danh sách', () => {
    const tracker = createProgressTracker();
    tracker.update({ status: 'done', file: model?.path });
    tracker.update({ status: 'progress', file: 'khong-co.bin', loaded: 999 });
    tracker.update('hỏng');
    tracker.update(null);
    expect(tracker.current().loaded).toBe(model?.bytes);
  });

  it('không vượt quá kích thước đã biết của file', () => {
    const tracker = createProgressTracker();
    tracker.update({ status: 'progress', file: tokenizer?.path, loaded: 10 ** 12 });
    expect(tracker.current().loaded).toBe(tokenizer?.bytes);
  });
});

describe('nguồn embedding', () => {
  const base = defaultAiSettings();

  it('mặc định là nhà cung cấp; "Trên máy" cho khoá nguồn riêng', () => {
    expect(base.embedSource).toBe('provider');
    const remote = resolveEmbedSource(base);
    const local = resolveEmbedSource({ ...base, embedSource: 'local' });
    expect(remote?.providerId).toBe('openai');
    expect(local).toEqual({ providerId: 'local', model: LOCAL_MODEL_ID });
    expect(embedKey(remote!)).not.toBe(embedKey(local!));
    expect(embedKey(local!)).toContain('local|xenova/multilingual-e5-small');
  });

  it('dùng được khi nhà cung cấp là Anthropic (không có API embeddings)', () => {
    const anthropic = { ...base, providerId: 'anthropic' as const };
    expect(resolveEmbedSource(anthropic)).toBeNull();
    expect(resolveEmbedSource({ ...anthropic, embedSource: 'local' })?.providerId).toBe('local');
  });

  it('sanitize: giá trị lạ về "provider", "local" được giữ', () => {
    expect(sanitizeAiSettings({ embedSource: 'local' }).embedSource).toBe('local');
    expect(sanitizeAiSettings({ embedSource: 'x' }).embedSource).toBe('provider');
    expect(sanitizeAiSettings({}).embedSource).toBe('provider');
  });

  it('embedBatch không bao giờ gọi mạng cho nguồn trên máy', async () => {
    await expect(
      embedBatch(
        { providerId: 'local', model: LOCAL_MODEL_ID },
        { apiKey: '', baseUrl: '' },
        ['a'],
        'query',
      ),
    ).rejects.toThrow(/worker/);
  });
});
