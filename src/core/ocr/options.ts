/**
 * Tuỳ chọn khởi tạo tesseract.js. Mọi đường dẫn đều trỏ vào file đã bundle
 * trong extension; thư viện không bao giờ được dùng đường dẫn mặc định của nó
 * (CDN). `getUrl` thường là `chrome.runtime.getURL`.
 */
export type OcrWorkerOptions = {
  workerPath: string;
  corePath: string;
  langPath: string;
  /** Không tạo worker từ blob URL: CSP của extension chặn. */
  workerBlobURL: false;
  /** File ngôn ngữ đóng gói dạng `.traineddata.gz`. */
  gzip: true;
  /** Dữ liệu đã nằm trong extension, không cần cache thêm vào IndexedDB. */
  cacheMethod: 'none';
};

/** Thư mục chứa file OCR trong gói extension (khớp `ocrAssets` ở vite.config.ts). */
export const OCR_ASSET_DIR = 'ocr';
export const OCR_WORKER_FILE = `${OCR_ASSET_DIR}/worker.min.js`;
export const OCR_CORE_DIR = `${OCR_ASSET_DIR}/core`;
export const OCR_LANG_DIR = `${OCR_ASSET_DIR}/lang`;
/** Thứ tự ưu tiên ngôn ngữ: tiếng Việt trước, tiếng Anh cho phần lẫn. */
export const OCR_LANGUAGES = ['vie', 'eng'] as const;

export function buildOcrOptions(getUrl: (path: string) => string): OcrWorkerOptions {
  return {
    workerPath: getUrl(OCR_WORKER_FILE),
    corePath: getUrl(OCR_CORE_DIR),
    langPath: getUrl(OCR_LANG_DIR),
    workerBlobURL: false,
    gzip: true,
    cacheMethod: 'none',
  };
}
