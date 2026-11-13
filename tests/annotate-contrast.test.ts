import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../src/viewer/styles.css', import.meta.url)),
  'utf8',
);

function luminance(hex: string): number {
  const linear = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const channel = (hex: string, i: number) => Number.parseInt(hex.slice(i, i + 2), 16);

/** Màu thấy được khi highlight (nhân với nền trắng, độ đậm `alpha`) phủ lên trang trắng. */
function onWhite(hex: string, alpha: number): string {
  const mix = (c: number) => Math.round(255 * (1 - alpha) + c * alpha);
  return `#${[1, 3, 5].map((i) => mix(channel(hex, i)).toString(16).padStart(2, '0')).join('')}`;
}

describe('màu highlight', () => {
  const alpha = Number(/--annot-opacity:\s*([\d.]+)/.exec(css)?.[1]);
  const found = new Map(
    [...css.matchAll(/--annot-(yellow|green|blue|pink):\s*(#[0-9a-f]{6})/gi)].map(
      (m) => [m[1] as string, m[2] as string] as const,
    ),
  );
  const colors = ['yellow', 'green', 'blue', 'pink'].map(
    (name) => [name, found.get(name)] as const,
  );

  it('khai báo đủ 4 màu và độ đậm', () => {
    expect(alpha).toBeGreaterThan(0);
    for (const [, hex] of colors) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  // Trang PDF luôn nền trắng (cả chế độ tối), chữ đen/xám đậm: đo chữ #1d1d1b trên nền đã tô.
  it.each(colors)('chữ trên highlight %s đạt tương phản WCAG AA (≥ 4,5:1)', (_name, hex) => {
    const ratio = contrast('#1d1d1b', onWhite(hex as string, alpha));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('màu nút chọn (không trong suốt) vẫn phân biệt được với nền ở cả hai chế độ nhờ viền', () => {
    // Nút dùng viền var(--border)/var(--text); chỉ kiểm tra có quy tắc viền cho swatch.
    expect(css).toMatch(/\.annot-swatch\s*\{[^}]*border:\s*2px solid var\(--border\)/);
  });
});
