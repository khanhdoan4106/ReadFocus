import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import pkg from '../package.json';
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
});

describe('chuỗi tiếng Việt', () => {
  it('không có chuỗi rỗng', () => {
    for (const [key, value] of Object.entries(vi)) {
      if (typeof value !== 'string') continue;
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});
