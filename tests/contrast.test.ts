import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../src/viewer/styles.css', import.meta.url)),
  'utf8',
);

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`không thấy ${selector}`);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const THEMES = [
  { name: 'sáng', vars: tokens(':root'), onAccent: '#ffffff' },
  { name: 'tối', vars: tokens(":root[data-theme='dark']"), onAccent: '#0d1210' },
];

describe('tương phản chữ (WCAG AA, tối thiểu 4,5:1)', () => {
  for (const theme of THEMES) {
    const v = theme.vars;
    const pairs: [string, string, string][] = [
      ['chữ thường / nền', v.fg as string, v.bg as string],
      ['chữ thường / bề mặt', v.fg as string, v.surface as string],
      ['chữ phụ / nền', v.muted as string, v.bg as string],
      ['chữ phụ / bề mặt', v.muted as string, v.surface as string],
      ['màu nhấn / nền', v.accent as string, v.bg as string],
      ['màu nhấn / bề mặt', v.accent as string, v.surface as string],
      ['cảnh báo / nền', v.danger as string, v.bg as string],
      ['cảnh báo / bề mặt', v.danger as string, v.surface as string],
      ['chữ trên nút chính', theme.onAccent, v.accent as string],
    ];
    for (const [label, fg, bg] of pairs) {
      it(`${theme.name}: ${label}`, () => {
        const ratio = contrast(fg, bg);
        expect(ratio, `${fg} trên ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
