import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('store documents match the manifest', () => {
  const permissionsDoc = read('docs/PERMISSIONS.md');
  const storeDoc = read('store/permissions.md');
  const patterns = [...manifest.permissions, ...manifest.optional_host_permissions];

  it.each(patterns)('documents %s in docs/PERMISSIONS.md and store/permissions.md', (name) => {
    // `https://api.openai.com/*` etc. are documented by host, so compare the host part.
    const key = name.startsWith('http') || name.includes('://') ? name : `\`${name}\``;
    expect(permissionsDoc).toContain(key);
    expect(storeDoc).toContain(key);
  });

  it('keeps the manifest description within 132 characters in every locale', () => {
    for (const locale of ['en', 'vi']) {
      const messages = JSON.parse(read(`public/_locales/${locale}/messages.json`)) as {
        extDescription: { message: string };
      };
      expect(messages.extDescription.message.length).toBeLessThanOrEqual(132);
    }
  });

  it('puts the same summary text in the listings as in the locale files', () => {
    for (const [locale, file] of [
      ['en', 'store/listing.en.md'],
      ['vi', 'store/listing.vi.md'],
    ] as const) {
      const messages = JSON.parse(read(`public/_locales/${locale}/messages.json`)) as {
        extDescription: { message: string };
      };
      expect(read(file)).toContain(messages.extDescription.message);
    }
  });

  it('ships 1280x800 PNG screenshots, five per language', () => {
    for (const lang of ['en', 'vi']) {
      const dir = join(root, 'store', 'screenshots', lang);
      const files = readdirSync(dir).filter((name) => name.endsWith('.png'));
      expect(files).toHaveLength(5);
      for (const name of files) {
        const header = readFileSync(join(dir, name));
        expect(header.subarray(1, 4).toString('latin1')).toBe('PNG');
        expect(header.readUInt32BE(16)).toBe(1280);
        expect(header.readUInt32BE(20)).toBe(800);
      }
    }
  });
});
