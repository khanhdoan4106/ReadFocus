import { describe, expect, it } from 'vitest';
import { parseThemePreference, resolveTheme } from '../src/core/theme';

describe('parseThemePreference', () => {
  it('nhận ba giá trị hợp lệ', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('dữ liệu lạ hoặc thiếu quay về theo hệ thống', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('DARK')).toBe('system');
    expect(parseThemePreference(1)).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('tuỳ chọn thủ công thắng hệ điều hành', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('theo hệ thống thì dựa vào chế độ tối của máy', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
