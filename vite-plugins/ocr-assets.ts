import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * tesseract.js đặt sẵn địa chỉ CDN (cdn.jsdelivr.net) làm đường dẫn mặc định
 * cho worker, core wasm và dữ liệu ngôn ngữ. ReadFocus luôn truyền đường dẫn
 * cục bộ (xem `src/core/ocr/options.ts`), nên các chuỗi này không bao giờ được
 * dùng. Plugin thay chúng bằng một scheme không tồn tại: nếu có chỗ nào quên
 * cấu hình đường dẫn cục bộ thì thư viện báo lỗi rõ ràng thay vì âm thầm gọi
 * ra mạng, và `dist/` không còn tham chiếu CDN.
 *
 * Danh sách chuỗi CDN trong tesseract.js 7.0.0 (đều cùng tiền tố):
 * - dist/tesseract.esm.min.js: `workerPath` mặc định (defaultOptions của worker trình duyệt);
 * - dist/worker.min.js: `corePath` mặc định (getCore) và `langPath` mặc định (hai dạng
 *   `4.0.0_best_int` và `4.0.0`).
 */
export const TESSERACT_CDN_PREFIX = 'https://cdn.jsdelivr.net/npm/';
export const TESSERACT_UNCONFIGURED_PREFIX = 'ocr-path-not-configured://';

export function stripTesseractCdnDefaults(code: string): string {
  return code.split(TESSERACT_CDN_PREFIX).join(TESSERACT_UNCONFIGURED_PREFIX);
}

const CDN_PATTERN = /https?:\/\/(cdn|unpkg|cdnjs|esm\.sh|jsdelivr)/;

/** Bản `lstm` của core: ReadFocus chỉ dùng mạng LSTM nên bỏ các biến thể legacy cho nhẹ. */
const CORE_FILES = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];
const LANGUAGES = ['vie', 'eng'];

/** Gói thư viện OCR vào `dist/ocr/` và bỏ URL CDN mặc định của tesseract.js. */
export function ocrAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const packageDir = (name: string): string => dirname(require.resolve(`${name}/package.json`));

  return {
    name: 'readfocus-ocr-assets',
    enforce: 'pre',

    transform(code, id) {
      if (!/[\\/]node_modules[\\/]tesseract\.js[\\/]dist[\\/][^?]*\.js(\?|$)/.test(id)) {
        return null;
      }
      return { code: stripTesseractCdnDefaults(code), map: null };
    },

    generateBundle() {
      const emit = (fileName: string, source: string | Uint8Array): void => {
        this.emitFile({ type: 'asset', fileName, source });
      };

      const tesseract = packageDir('tesseract.js');
      const worker = stripTesseractCdnDefaults(
        readFileSync(join(tesseract, 'dist', 'worker.min.js'), 'utf8'),
      );
      if (CDN_PATTERN.test(worker)) {
        this.error('worker.min.js của tesseract.js vẫn còn tham chiếu CDN sau khi thay thế.');
      }
      emit('ocr/worker.min.js', worker);

      const core = packageDir('tesseract.js-core');
      for (const file of CORE_FILES) {
        emit(`ocr/core/${file}`, readFileSync(join(core, file)));
      }

      for (const lang of LANGUAGES) {
        const dir = packageDir(`@tesseract.js-data/${lang}`);
        emit(
          `ocr/lang/${lang}.traineddata.gz`,
          readFileSync(join(dir, '4.0.0_best_int', `${lang}.traineddata.gz`)),
        );
      }

      emit(
        'ocr/LICENSES.txt',
        [
          'tesseract.js (Apache-2.0), tesseract.js-core (Apache-2.0),',
          '@tesseract.js-data/vie và @tesseract.js-data/eng (MIT; dữ liệu huấn luyện Tesseract, Apache-2.0).',
          '',
          '--- tesseract.js-core LICENSE ---',
          readFileSync(join(core, 'LICENSE'), 'utf8'),
        ].join('\n'),
      );
    },
  };
}
