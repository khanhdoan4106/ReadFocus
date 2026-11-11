import { sanitizeAiSettings, type AiSettings } from '../core/llm/settings';

/** Khoá lưu trong `chrome.storage.local` (tuỳ chọn AI, không phải key). */
export const AI_SETTINGS_STORAGE_KEY = 'aiSettings';
/** Khoá lưu API key; tách riêng để "Xoá key" không đụng tuỳ chọn khác. */
export const AI_KEY_STORAGE_KEY = 'aiApiKey';

/**
 * Phần tối thiểu của `chrome.storage.StorageArea` mà lớp này cần. Nhờ vậy
 * test truyền được store giả, không cần `chrome` và không bao giờ in key.
 */
export type KeyStore = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
};

export type KeyScope = 'local' | 'session';

export function keyScopeFor(saveKey: boolean): KeyScope {
  return saveKey ? 'local' : 'session';
}

export async function saveApiKey(store: KeyStore, key: string): Promise<void> {
  const value = key.trim();
  if (value === '') throw new Error('empty key');
  await store.set({ [AI_KEY_STORAGE_KEY]: value });
}

export async function loadApiKey(store: KeyStore): Promise<string> {
  const data = await store.get(AI_KEY_STORAGE_KEY);
  const value = data[AI_KEY_STORAGE_KEY];
  return typeof value === 'string' ? value : '';
}

export async function clearApiKey(store: KeyStore): Promise<void> {
  await store.remove(AI_KEY_STORAGE_KEY);
}

export async function loadAiSettings(store: KeyStore): Promise<AiSettings> {
  const data = await store.get(AI_SETTINGS_STORAGE_KEY);
  return sanitizeAiSettings(data[AI_SETTINGS_STORAGE_KEY]);
}

export async function saveAiSettings(store: KeyStore, settings: AiSettings): Promise<void> {
  await store.set({ [AI_SETTINGS_STORAGE_KEY]: sanitizeAiSettings(settings) });
}
