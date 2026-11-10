import {
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../core/theme';

const CACHE_KEY = 'readfocus:theme';

function systemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Đọc bản cache đồng bộ để áp giao diện trước lần render đầu, tránh nháy sáng
 * khi người dùng chọn giao diện tối. IndexedDB vẫn là nguồn dữ liệu chính.
 */
export function readCachedTheme(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(CACHE_KEY));
  } catch {
    return 'system';
  }
}

/** Áp giao diện lên thẻ html và ghi bản cache; trả về giao diện thực tế. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemDark());
  document.documentElement.dataset.theme = resolved;
  try {
    window.localStorage.setItem(CACHE_KEY, preference);
  } catch {
    // Không ghi được cache thì vẫn đổi giao diện cho phiên hiện tại.
  }
  return resolved;
}

/** Theo dõi thay đổi giao diện hệ điều hành khi người dùng chọn "theo hệ thống". */
export function watchSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => onChange(media.matches ? 'dark' : 'light');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
