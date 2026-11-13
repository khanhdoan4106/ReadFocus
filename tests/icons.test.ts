import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
// @ts-expect-error script .mjs không có khai báo kiểu
import { encodePng, parseSvg, render } from '../scripts/make-icons.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const svgSource = readFileSync(`${root}assets/icon.svg`, 'utf8');

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

function pixel(png: Buffer, size: number, x: number, y: number): number[] {
  // Bóc PNG tự sinh: IHDR + một IDAT, bộ lọc 0.
  const data = png.subarray(png.indexOf('IDAT') + 4, png.indexOf('IEND') - 8);
  const raw = inflateSync(data);
  const offset = y * (size * 4 + 1) + 1 + x * 4;
  return [...raw.subarray(offset, offset + 4)];
}

describe('icon', () => {
  it('manifest trỏ tới đủ 16, 32, 48, 128 và file PNG có đúng kích thước', () => {
    for (const size of [16, 32, 48, 128]) {
      const rel = (manifest.icons as Record<string, string>)[String(size)];
      expect(rel, String(size)).toBe(`icons/icon-${size}.png`);
      const png = readFileSync(`${root}public/${rel}`);
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
      expect((manifest.action.default_icon as Record<string, string>)[String(size)]).toBe(rel);
    }
  });

  it('SVG nguồn chỉ dùng phần tử script vẽ được; file PNG khớp với bản vẽ lại từ SVG', () => {
    const svg = parseSvg(svgSource);
    expect(svg.shapes.length).toBeGreaterThan(3);
    for (const size of [16, 48]) {
      const committed = readFileSync(`${root}public/icons/icon-${size}.png`);
      expect(committed.equals(encodePng(size, render(svg, size)))).toBe(true);
    }
    expect(() => parseSvg('<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>')).toThrow(/path/);
  });

  it('16px: góc trong suốt, giữa trang trắng và dải sáng vàng còn thấy rõ', () => {
    const png = readFileSync(`${root}public/icons/icon-16.png`);
    expect(pixel(png, 16, 0, 0)[3]).toBe(0);
    for (const channel of pixel(png, 16, 11, 4).slice(0, 3)) expect(channel).toBeGreaterThan(235);
    const band = pixel(png, 16, 3, 7);
    expect(band[0]).toBeGreaterThan(200);
    expect(band[2]).toBeLessThan(120);
  });

  it('tương phản đủ trên thanh công cụ sáng (#ffffff) và tối (#202124)', () => {
    const fills = [...svgSource.matchAll(/fill="#([0-9a-f]{6})"/gi)].map((m) => m[1] as string);
    const [bg, page] = fills;
    expect(contrast(bg as string, 'ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(bg as string, '202124')).toBeGreaterThanOrEqual(3);
    expect(contrast(page as string, bg as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('ffc832', bg as string)).toBeGreaterThanOrEqual(3);
  });
});
