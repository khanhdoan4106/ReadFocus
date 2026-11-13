import { en } from './en';
import { vi, type Messages } from './vi';

export type { Messages };
export type Locale = 'vi' | 'en';
/** Lựa chọn của người dùng: theo trình duyệt hoặc cố định một ngôn ngữ. */
export type LanguagePreference = 'auto' | Locale;

export const LANGUAGE_SETTING_KEY = 'uiLanguage';

const CATALOGS: Record<Locale, Messages> = { vi, en };

/** Trình duyệt tiếng Việt thì dùng tiếng Việt, mọi trường hợp khác dùng English. */
export function resolveLocale(preference: LanguagePreference, browserLanguage: string): Locale {
  if (preference !== 'auto') return preference;
  return browserLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function parseLanguagePreference(value: unknown): LanguagePreference {
  return value === 'vi' || value === 'en' ? value : 'auto';
}

export function browserLanguage(): string {
  return typeof navigator === 'undefined' ? 'en' : (navigator.language ?? 'en');
}

const MIRROR_KEY = 'readfocus.uiLanguage';

/** Bản sao trong localStorage để vẽ đúng ngôn ngữ ngay từ lần render đầu, trước khi đọc IndexedDB. */
export function readMirroredPreference(): LanguagePreference {
  try {
    return parseLanguagePreference(localStorage.getItem(MIRROR_KEY));
  } catch {
    return 'auto';
  }
}

export function mirrorPreference(preference: LanguagePreference): void {
  try {
    localStorage.setItem(MIRROR_KEY, preference);
  } catch {
    // Không có localStorage thì chỉ mất việc vẽ nhanh, không mất cài đặt.
  }
}

let current: Locale = resolveLocale(readMirroredPreference(), browserLanguage());
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  for (const listener of listeners) listener();
}

/** Gọi `listener` mỗi khi đổi ngôn ngữ; trả hàm huỷ đăng ký. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Chữ hiển thị theo ngôn ngữ hiện tại. Đọc `t.khoá` tại thời điểm render nên
 * component chỉ cần render lại khi đổi ngôn ngữ (xem `useLanguage`).
 */
export const t: Messages = new Proxy({} as Messages, {
  get: (_target, key) => CATALOGS[current][key as keyof Messages],
  has: (_target, key) => key in CATALOGS[current],
  ownKeys: () => Reflect.ownKeys(CATALOGS[current]),
  getOwnPropertyDescriptor: (_target, key) => ({
    configurable: true,
    enumerable: true,
    value: CATALOGS[current][key as keyof Messages],
  }),
});
