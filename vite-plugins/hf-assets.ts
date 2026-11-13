import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * @huggingface/transformers đặt sẵn địa chỉ CDN (cdn.jsdelivr.net) làm đường dẫn mặc định
 * tới runtime ONNX (`wasmPaths`). ReadFocus luôn truyền đường dẫn `chrome-extension://`
 * (xem `src/embed-worker/local-embed.worker.ts`), nên chuỗi này không bao giờ được dùng.
 * Plugin thay nó bằng một scheme không tồn tại: quên cấu hình thì thư viện báo lỗi rõ ràng
 * thay vì âm thầm gọi ra mạng, và `dist/` không còn tham chiếu CDN.
 *
 * Trong @huggingface/transformers 4.3.2 chỉ có đúng một chỗ (dist/transformers.web.js,
 * mẫu chuỗi `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`).
 *
 * Thư viện cũng nạp `onnxruntime-web/webgpu`. ReadFocus chỉ chạy backend wasm (nhẹ hơn
 * nhiều, không phụ thuộc GPU), nên import này được chuyển sang bản wasm.
 */
export const HF_CDN_PREFIX = 'https://cdn.jsdelivr.net/npm/';
export const HF_UNCONFIGURED_PREFIX = 'ort-path-not-configured://';

export function stripHfCdnDefaults(code: string): string {
  return code.split(HF_CDN_PREFIX).join(HF_UNCONFIGURED_PREFIX);
}

/** Thư mục chứa runtime ONNX trong gói extension (khớp `ORT_ASSET_DIR` ở worker). */
export const ORT_ASSET_DIR = 'ort';
const ORT_RUNTIME_FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];

const CDN_PATTERN = /https?:\/\/(cdn|unpkg|cdnjs|esm\.sh|jsdelivr)/;

const require = createRequire(import.meta.url);
// `package.json` không nằm trong `exports`; entry chính nằm trong dist/.
const ortDist = (): string => dirname(require.resolve('onnxruntime-web'));

/** Dùng cho cả bản build chính và build worker: bỏ chuỗi CDN, đổi import webgpu sang wasm. */
export function hfTransform(): Plugin {
  return {
    name: 'readfocus-hf-transform',
    enforce: 'pre',

    resolveId(source) {
      // Bản không kèm wasm: file .wasm và .mjs của runtime do `hfAssets` đóng gói riêng.
      if (source === 'onnxruntime-web/webgpu') return join(ortDist(), 'ort.wasm.min.mjs');
      return null;
    },

    transform(code, id) {
      if (
        !/[\\/]node_modules[\\/]@huggingface[\\/]transformers[\\/]dist[\\/][^?]*\.js(\?|$)/.test(id)
      ) {
        return null;
      }
      const next = stripHfCdnDefaults(code);
      if (CDN_PATTERN.test(next)) {
        this.error('@huggingface/transformers vẫn còn tham chiếu CDN sau khi thay thế.');
      }
      return { code: next, map: null };
    },
  };
}

/** Gói runtime ONNX (wasm, không GPU) vào `dist/ort/`. Trọng số model KHÔNG nằm trong gói. */
export function hfAssets(): Plugin {
  return {
    name: 'readfocus-hf-assets',

    generateBundle() {
      const dist = ortDist();
      for (const file of ORT_RUNTIME_FILES) {
        const source = readFileSync(join(dist, file));
        if (file.endsWith('.mjs') && CDN_PATTERN.test(source.toString('utf8'))) {
          this.error(`${file} của onnxruntime-web có tham chiếu CDN.`);
        }
        this.emitFile({ type: 'asset', fileName: `${ORT_ASSET_DIR}/${file}`, source });
      }

      const hf = join(dirname(require.resolve('@huggingface/transformers')), '..');
      this.emitFile({
        type: 'asset',
        fileName: `${ORT_ASSET_DIR}/LICENSES.txt`,
        source: [
          '@huggingface/transformers (Apache-2.0) và onnxruntime-web (MIT, Microsoft).',
          'Model multilingual-e5-small (MIT, intfloat; bản ONNX của Xenova) tải từ Hugging Face khi người dùng đồng ý, không nằm trong gói.',
          '',
          '--- @huggingface/transformers LICENSE ---',
          readFileSync(join(hf, 'LICENSE'), 'utf8'),
        ].join('\n'),
      });
    },
  };
}
