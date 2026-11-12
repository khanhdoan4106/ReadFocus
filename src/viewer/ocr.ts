import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ExistingPage, PageRange } from '../core/ocr/pages';
import type { OcrInput } from '../core/ocr/types';

/** Hệ số render cho OCR (~2x): đủ nét để nhận dạng mà không tốn quá nhiều bộ nhớ. */
export const OCR_RENDER_SCALE = 2;
/** Cạnh dài tối đa của ảnh OCR, tránh canvas quá lớn với trang khổ to. */
const OCR_MAX_SIDE = 4000;

/** Render một trang ra canvas để đưa vào OCR. */
export async function renderPageForOcr(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  signal: AbortSignal,
): Promise<OcrInput> {
  const page = await pdfDoc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(OCR_RENDER_SCALE, OCR_MAX_SIDE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không tạo được canvas để nhận dạng chữ');

  const task = page.render({ canvas, canvasContext: context, viewport });
  const cancel = () => task.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await task.promise;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
  return { image: canvas, width: canvas.width, height: canvas.height };
}

/** Văn bản lớp chữ của PDF cho từng trang trong khoảng (để biết trang nào đã có chữ). */
export async function readTextLayers(
  pdfDoc: PDFDocumentProxy,
  range: PageRange,
): Promise<ExistingPage[]> {
  const pages: ExistingPage[] = [];
  for (let number = range.from; number <= range.to; number += 1) {
    const page = await pdfDoc.getPage(number);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ');
    pages.push({ page: number, text, source: 'pdf' });
  }
  return pages;
}
