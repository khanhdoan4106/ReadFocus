// Tạo icon tạm cho extension. Chạy: node scripts/make-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const SIZES = [16, 48, 128];
const SCALE = 4;

const BG = [31, 111, 92];
const PAGE = [250, 250, 247];
const INK = [31, 111, 92];

function roundRect(px, size, x, y, w, h, radius, color) {
  const r = Math.min(radius, w / 2, h / 2);
  const x0 = x;
  const y0 = y;
  const x1 = x + w;
  const y1 = y + h;

  for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
    for (let pxi = Math.floor(x0); pxi < Math.ceil(x1); pxi++) {
      if (pxi < 0 || py < 0 || pxi >= size || py >= size) continue;

      const cx = Math.min(Math.max(pxi + 0.5, x0 + r), x1 - r);
      const cy = Math.min(Math.max(py + 0.5, y0 + r), y1 - r);
      const dx = pxi + 0.5 - cx;
      const dy = py + 0.5 - cy;

      if (dx * dx + dy * dy > r * r) continue;

      const offset = (py * size + pxi) * 4;
      px[offset] = color[0];
      px[offset + 1] = color[1];
      px[offset + 2] = color[2];
      px[offset + 3] = 255;
    }
  }
}

function drawIcon(size) {
  const big = size * SCALE;
  const px = new Float32Array(big * big * 4);

  roundRect(px, big, 0, 0, big, big, big * 0.22, BG);
  roundRect(px, big, big * 0.26, big * 0.2, big * 0.48, big * 0.6, big * 0.04, PAGE);
  roundRect(px, big, big * 0.34, big * 0.34, big * 0.32, big * 0.055, big * 0.02, INK);
  roundRect(px, big, big * 0.34, big * 0.47, big * 0.32, big * 0.055, big * 0.02, INK);
  roundRect(px, big, big * 0.34, big * 0.6, big * 0.2, big * 0.055, big * 0.02, INK);

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const offset = ((y * SCALE + sy) * big + (x * SCALE + sx)) * 4;
          for (let c = 0; c < 4; c++) acc[c] += px[offset + c];
        }
      }
      const target = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) {
        out[target + c] = Math.round(acc[c] / (SCALE * SCALE));
      }
    }
  }

  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
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

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outDir, { recursive: true });

for (const size of SIZES) {
  const png = encodePng(size, drawIcon(size));
  const file = path.join(outDir, `icon-${size}.png`);
  await writeFile(file, png);
  console.log(`Đã tạo public/icons/icon-${size}.png`);
}
