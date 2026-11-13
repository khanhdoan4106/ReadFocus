import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { vi as viText } from '../src/i18n/vi';

const css = readFileSync(
  fileURLToPath(new URL('../src/viewer/styles.css', import.meta.url)),
  'utf8',
);

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`không thấy ${selector}`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('hàng tab thanh bên', () => {
  it('mỗi nút tab giữ nhãn trên một dòng, hàng chỉ xuống dòng giữa các nút', () => {
    expect(block('.sidebar__tab')).toMatch(/white-space:\s*nowrap/);
    expect(block('.sidebar__tabs')).toMatch(/flex-wrap:\s*wrap/);
  });

  it.each([
    ['vi', viText],
    ['en', en],
  ] as const)('nhãn tab %s là một dòng, không có ký tự xuống dòng', (_code, text) => {
    const labels = [
      text.tocTitle,
      text.summaryTab,
      text.askTab,
      text.flashTab,
      text.searchTab,
      text.focusTab,
      text.settingsTab,
    ];
    for (const label of labels) {
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/[\r\n­]/);
    }
  });
});
