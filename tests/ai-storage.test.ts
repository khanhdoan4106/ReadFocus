import { describe, expect, it } from 'vitest';
import {
  AI_KEY_STORAGE_KEY,
  AI_SETTINGS_STORAGE_KEY,
  clearApiKey,
  keyScopeFor,
  loadAiSettings,
  loadApiKey,
  saveAiSettings,
  saveApiKey,
  type KeyStore,
} from '../src/storage/ai';
import { defaultAiSettings } from '../src/core/llm/settings';

function memoryStore(initial: Record<string, unknown> = {}): KeyStore & {
  data: Record<string, unknown>;
  writes: number;
} {
  const store = {
    data: { ...initial },
    writes: 0,
    async get(key: string) {
      return key in store.data ? { [key]: store.data[key] } : {};
    },
    async set(items: Record<string, unknown>) {
      store.writes += 1;
      Object.assign(store.data, items);
    },
    async remove(key: string) {
      store.writes += 1;
      delete store.data[key];
    },
  };
  return store;
}

describe('key storage', () => {
  it('lưu, đọc và xoá key', async () => {
    const store = memoryStore();
    expect(await loadApiKey(store)).toBe('');

    await saveApiKey(store, '  sk-test  ');
    expect(store.data[AI_KEY_STORAGE_KEY]).toBe('sk-test');
    expect(await loadApiKey(store)).toBe('sk-test');

    await clearApiKey(store);
    expect(await loadApiKey(store)).toBe('');
    expect(AI_KEY_STORAGE_KEY in store.data).toBe(false);
  });

  it('không lưu key rỗng', async () => {
    const store = memoryStore();
    await expect(saveApiKey(store, '   ')).rejects.toThrow('empty key');
    expect(store.writes).toBe(0);
  });

  it('key không nằm cùng object với tuỳ chọn AI', async () => {
    const store = memoryStore();
    await saveApiKey(store, 'sk-test');
    await saveAiSettings(store, defaultAiSettings());
    expect(store.data[AI_KEY_STORAGE_KEY]).toBe('sk-test');
    expect(store.data[AI_SETTINGS_STORAGE_KEY]).not.toHaveProperty('apiKey');
  });

  it('đọc tuỳ chọn AI đã chuẩn hoá, dữ liệu hỏng trả mặc định', async () => {
    const store = memoryStore({
      [AI_SETTINGS_STORAGE_KEY]: {
        providerId: 'gemini',
        model: 'gemini-test',
        saveKey: false,
      },
    });
    const settings = await loadAiSettings(store);
    expect(settings.providerId).toBe('gemini');
    expect(settings.model).toBe('gemini-test');
    expect(settings.saveKey).toBe(false);
    expect(await loadAiSettings(memoryStore())).toEqual(defaultAiSettings());
  });

  it('lưu tuỳ chọn AI đã được chuẩn hoá', async () => {
    const store = memoryStore();
    await saveAiSettings(store, { ...defaultAiSettings(), model: '   ' });
    const stored = store.data[AI_SETTINGS_STORAGE_KEY] as Record<string, unknown>;
    expect(typeof stored.model).toBe('string');
    expect(stored.model).not.toBe('');
  });

  it('chọn scope theo tuỳ chọn lưu key', () => {
    expect(keyScopeFor(true)).toBe('local');
    expect(keyScopeFor(false)).toBe('session');
  });
});
