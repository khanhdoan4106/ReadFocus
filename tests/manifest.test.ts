import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import pkg from '../package.json';
import { en } from '../src/i18n/en';
import { vi } from '../src/i18n/vi';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('manifest', () => {
  it('dùng Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('có cùng phiên bản với package.json', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('trỏ tới các icon có thật trong public/', () => {
    for (const iconPath of Object.values(manifest.icons)) {
      expect(existsSync(`${root}public/${iconPath}`), iconPath).toBe(true);
    }
  });

  it('giữ quyền host rộng ở dạng tuỳ chọn, không xin lúc cài', () => {
    expect(manifest.permissions).toContain('declarativeNetRequestWithHostAccess');
    expect('host_permissions' in manifest).toBe(false);
    expect(manifest.optional_host_permissions).toContain('*://*/*');
    expect(manifest.web_accessible_resources[0]?.resources).toContain('viewer.html');
  });

  it('chỉ xin đúng origin nhà cung cấp AI trong danh sách v1', () => {
    const llmOrigins = manifest.optional_host_permissions.filter((origin) => origin !== '*://*/*');
    expect(llmOrigins).toEqual([
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.anthropic.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
  });
});

describe('chuỗi tiếng Việt', () => {
  it('không có chuỗi rỗng', () => {
    for (const [key, value] of Object.entries(vi)) {
      if (typeof value !== 'string') continue;
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});

describe('chrome.i18n cho manifest', () => {
  type Messages = Record<string, { message: string }>;
  const load = (locale: string): Messages =>
    JSON.parse(readFileSync(`${root}public/_locales/${locale}/messages.json`, 'utf8')) as Messages;
  const used = [manifest.name, manifest.description, manifest.action.default_title].map(
    (value) => /^__MSG_(\w+)__$/.exec(value)?.[1],
  );

  it('tên, mô tả và chú thích nút đều dùng khoá __MSG_', () => {
    expect(used.every((key) => key !== undefined)).toBe(true);
  });

  it('default_locale có thư mục thật; vi và en cùng bộ khoá', () => {
    expect(existsSync(`${root}public/_locales/${manifest.default_locale}`)).toBe(true);
    expect(Object.keys(load('vi')).sort()).toEqual(Object.keys(load('en')).sort());
  });

  it('mọi khoá manifest dùng đều có ở cả hai ngôn ngữ, không rỗng, mô tả không quá 132 ký tự', () => {
    for (const locale of ['vi', 'en']) {
      const messages = load(locale);
      for (const key of used) {
        const message = messages[key as string]?.message ?? '';
        expect(message.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      }
      expect(messages.extDescription?.message.length).toBeLessThanOrEqual(132);
    }
  });

  it('mục menu chuột phải của service worker khớp bảng chữ của viewer ở cả hai ngôn ngữ', () => {
    expect(load('vi').contextMenuOpen?.message).toBe(vi.contextMenuOpen);
    expect(load('en').contextMenuOpen?.message).toBe(en.contextMenuOpen);
  });
});
