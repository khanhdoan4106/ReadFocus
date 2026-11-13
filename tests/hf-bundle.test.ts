import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { HF_CDN_PREFIX, ORT_ASSET_DIR, stripHfCdnDefaults } from '../vite-plugins/hf-assets';

const root = fileURLToPath(new URL('..', import.meta.url));
const CDN = /cdn\.jsdelivr|jsdelivr\.net|unpkg\.com|cdnjs\.|esm\.sh/;
const distFile = join(root, 'node_modules', '@huggingface', 'transformers', 'dist');

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('stripHfCdnDefaults', () => {
  it('transformers.web.js hết tham chiếu CDN sau khi thay (bản duy nhất trình duyệt dùng)', () => {
    const original = readFileSync(join(distFile, 'transformers.web.js'), 'utf8');
    expect(original).toContain(HF_CDN_PREFIX);
    expect(stripHfCdnDefaults(original)).not.toMatch(CDN);
  });

  it('chỉ đổi tiền tố CDN, phần còn lại giữ nguyên', () => {
    const code = 'a=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${v}/dist/`;b=1';
    expect(stripHfCdnDefaults(code)).toBe(
      'a=`ort-path-not-configured://onnxruntime-web@${v}/dist/`;b=1',
    );
  });
});

describe('manifest cho embedding trên máy', () => {
  it('không thêm quyền nào mới cho việc tải model (Hugging Face cho phép CORS)', () => {
    const origins = manifest.optional_host_permissions;
    expect(origins.some((origin) => origin.includes('huggingface'))).toBe(false);
    expect(manifest.permissions).not.toContain('tabs');
  });
});

describe('dist/ sau khi build', () => {
  const dist = join(root, 'dist');

  it.skipIf(!existsSync(dist))('không còn chuỗi CDN trong file JS, HTML, CSS, mjs', () => {
    const offenders = listFiles(dist)
      .filter((file) => /\.(m?js|html|css)$/.test(file))
      .filter((file) => CDN.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(dist.length + 1));
    expect(offenders).toEqual([]);
  });

  it.skipIf(!existsSync(join(dist, ORT_ASSET_DIR)))('có runtime ONNX wasm cục bộ', () => {
    for (const file of [
      'ort-wasm-simd-threaded.mjs',
      'ort-wasm-simd-threaded.wasm',
      'LICENSES.txt',
    ]) {
      expect(existsSync(join(dist, ORT_ASSET_DIR, file)), file).toBe(true);
    }
  });

  it.skipIf(!existsSync(dist))('trọng số model không nằm trong gói', () => {
    const big = listFiles(dist).filter((file) => /\.(onnx|safetensors|bin)$/.test(file));
    expect(big).toEqual([]);
  });
});
