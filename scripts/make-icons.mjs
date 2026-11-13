// Sinh icon PNG (16, 32, 48, 128) từ assets/icon.svg. Chạy: node scripts/make-icons.mjs
//
// Không dùng thư viện vẽ SVG nào: script chỉ hiểu <rect> (có rx), <circle> và <polygon>
// với màu đặc (fill, fill-opacity). Gặp phần tử khác thì dừng, để SVG nguồn luôn vẽ được.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 8;
const SUPPORTED = new Set(['svg', 'title', 'rect', 'circle', 'polygon']);

export function parseSvg(source) {
  const view = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(source);
  if (!view || view[1] !== view[2]) throw new Error('SVG cần viewBox vuông bắt đầu từ 0 0');
  const shapes = [];
  const cleaned = source.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of cleaned.matchAll(/<([a-zA-Z]+)\b([^>]*?)\/?>/g)) {
    const tag = match[1];
    if (!SUPPORTED.has(tag)) throw new Error(`Phần tử SVG chưa hỗ trợ: <${tag}>`);
    if (tag === 'svg' || tag === 'title') continue;
    const attrs = Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    const fill = /^#([0-9a-f]{6})$/i.exec(attrs.fill ?? '');
    if (!fill) throw new Error(`<${tag}> cần fill dạng #rrggbb`);
    const hex = fill[1];
    const color = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    const alpha = attrs['fill-opacity'] === undefined ? 1 : Number(attrs['fill-opacity']);
    const num = (name, fallback = 0) =>
      attrs[name] === undefined ? fallback : Number(attrs[name]);
    if (tag === 'rect') {
      const rx = Math.min(num('rx'), num('width') / 2, num('height') / 2);
      shapes.push({
        type: 'rect',
        x: num('x'),
        y: num('y'),
        w: num('width'),
        h: num('height'),
        rx,
        color,
        alpha,
      });
    } else if (tag === 'circle') {
      shapes.push({ type: 'circle', cx: num('cx'), cy: num('cy'), r: num('r'), color, alpha });
    } else {
      const points = (attrs.points ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      shapes.push({ type: 'polygon', points, color, alpha });
    }
  }
  return { size: Number(view[1]), shapes };
}

function covers(shape, x, y) {
  if (shape.type === 'circle') return (x - shape.cx) ** 2 + (y - shape.cy) ** 2 <= shape.r ** 2;
  if (shape.type === 'rect') {
    const { x: x0, y: y0, w, h, rx } = shape;
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
    const cx = Math.min(Math.max(x, x0 + rx), x0 + w - rx);
    const cy = Math.min(Math.max(y, y0 + rx), y0 + h - rx);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rx * rx;
  }
  let inside = false;
  const p = shape.points;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i],
      yi = p[i + 1],
      xj = p[j],
      yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Vẽ `size` x `size` điểm ảnh, lấy mẫu SUPERSAMPLE² điểm mỗi ảnh, trộn "source over". */
export function render(svg, size) {
  const out = Buffer.alloc(size * size * 4);
  const unit = svg.size / (size * SUPERSAMPLE);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0; // đã nhân alpha
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px * SUPERSAMPLE + sx + 0.5) * unit;
          const y = (py * SUPERSAMPLE + sy + 0.5) * unit;
          let sr = 0,
            sg = 0,
            sb = 0,
            sa = 0;
          for (const shape of svg.shapes) {
            if (!covers(shape, x, y)) continue;
            const k = shape.alpha;
            sr = shape.color[0] * k + sr * (1 - k);
            sg = shape.color[1] * k + sg * (1 - k);
            sb = shape.color[2] * k + sb * (1 - k);
            sa = k + sa * (1 - k);
          }
          r += sr;
          g += sg;
          b += sb;
          a += sa;
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE;
      const o = (py * size + px) * 4;
      const alpha = a / n;
      out[o] = alpha === 0 ? 0 : Math.round(r / n / alpha);
      out[o + 1] = alpha === 0 ? 0 : Math.round(g / n / alpha);
      out[o + 2] = alpha === 0 ? 0 : Math.round(b / n / alpha);
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const svg = parseSvg(await readFile(path.join(root, 'assets', 'icon.svg'), 'utf8'));
  const outDir = path.join(root, 'public', 'icons');
  await mkdir(outDir, { recursive: true });
  for (const size of SIZES) {
    await writeFile(path.join(outDir, `icon-${size}.png`), encodePng(size, render(svg, size)));
    console.log(`Đã tạo public/icons/icon-${size}.png`);
  }
}
