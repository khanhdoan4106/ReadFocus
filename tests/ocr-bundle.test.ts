import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { stripTesseractCdnDefaults, TESSERACT_CDN_PREFIX } from '../vite-plugins/ocr-assets';

const root = fileURLToPath(new URL('..', import.meta.url));
const CDN = /cdn\.jsdelivr|jsdelivr\.net|unpkg\.com|cdnjs\.|esm\.sh/;

function readLib(file: string): string {
  return readFileSync(join(root, 'node_modules', 'tesseract.js', 'dist', file), 'utf8');
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('stripTesseractCdnDefaults', () => {
  // Hai file này chứa toàn bộ URL CDN mặc định của tesseract.js 7.0.0.
  it.each(['tesseract.esm.min.js', 'worker.min.js'])(
    '%s hết tham chiếu CDN sau khi thay',
    (file) => {
      const original = readLib(file);
      expect(original).toContain(TESSERACT_CDN_PREFIX);

      expect(stripTesseractCdnDefaults(original)).not.toMatch(CDN);
    },
  );

  it('chỉ đổi tiền tố CDN, phần còn lại của file giữ nguyên', () => {
    const code = 'a="https://cdn.jsdelivr.net/npm/tesseract.js@v7/dist/worker.min.js";b=1';
    expect(stripTesseractCdnDefaults(code)).toBe(
      'a="ocr-path-not-configured://tesseract.js@v7/dist/worker.min.js";b=1',
    );
  });
});

describe('manifest cho OCR', () => {
  it('cho phép biên dịch wasm trong trang extension nhưng không cho script ngoài', () => {
    expect(manifest.content_security_policy.extension_pages).toBe(
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    );
  });
});

describe('dist/ sau khi build', () => {
  const dist = join(root, 'dist');

  // Chạy sau `npm run build`; bước grep CDN của CI vẫn là chốt chặn chính thức.
  it.skipIf(!existsSync(dist))('không còn chuỗi CDN trong file JS, HTML, CSS', () => {
    const offenders = listFiles(dist)
      .filter((file) => /\.(m?js|html|css)$/.test(file))
      .filter((file) => CDN.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(dist.length + 1));

    expect(offenders).toEqual([]);
  });

  it.skipIf(!existsSync(join(dist, 'ocr')))('có đủ worker, core lstm và dữ liệu vie + eng', () => {
    for (const file of [
      'ocr/worker.min.js',
      'ocr/core/tesseract-core-lstm.wasm.js',
      'ocr/core/tesseract-core-simd-lstm.wasm.js',
      'ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js',
      'ocr/lang/vie.traineddata.gz',
      'ocr/lang/eng.traineddata.gz',
      'ocr/LICENSES.txt',
    ]) {
      expect(existsSync(join(dist, file)), file).toBe(true);
    }
  });
});
