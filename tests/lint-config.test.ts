import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('cấu hình lint', () => {
  it('.prettierignore bỏ qua .claude/ (cấu hình cục bộ của máy)', () => {
    const lines = readFileSync(
      fileURLToPath(new URL('../.prettierignore', import.meta.url)),
      'utf8',
    )
      .split(/\r?\n/)
      .map((line) => line.trim());
    expect(lines).toContain('.claude/');
  });
});
