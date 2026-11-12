/**
 * Ta import bản `dist` của tesseract.js (một file ESM) để build đi qua plugin
 * `ocrAssets` trong vite.config.ts, nơi bỏ các URL CDN mặc định của thư viện.
 * Kiểu dùng lại kiểu chính thức của gói.
 */
declare module 'tesseract.js/dist/tesseract.esm.min.js' {
  import type Tesseract from 'tesseract.js';
  const lib: typeof Tesseract;
  export default lib;
}
