export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Key lưu trong IndexedDB `settings` và bản cache để áp giao diện trước khi render. */
export const THEME_SETTING_KEY = 'theme';

/** Giá trị lạ (dữ liệu cũ hoặc hỏng) quay về "theo hệ thống". */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/** Giao diện thực tế: tuỳ chọn thủ công thắng, còn "system" thì theo hệ điều hành. */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}
