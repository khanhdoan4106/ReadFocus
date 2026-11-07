import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Giới hạn mềm để tránh treo tab khi người dùng mở file quá lớn. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

export type PdfOpenResult =
  | { ok: true; doc: PDFDocumentProxy; close: () => Promise<void> }
  | { ok: false; reason: 'not-pdf' | 'too-large' | 'password' | 'invalid' | 'unknown' };

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export async function openPdfFile(file: File): Promise<PdfOpenResult> {
  if (!isPdfFile(file)) return { ok: false, reason: 'not-pdf' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' };

  let data: ArrayBuffer;
  try {
    data = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  return openPdfData(data);
}

export async function openPdfData(data: ArrayBuffer): Promise<PdfOpenResult> {
  try {
    // pdf.js chuyển buffer sang worker, nên truyền bản sao để giữ dữ liệu gốc.
    const task = getDocument({ data: new Uint8Array(data.slice(0)) });
    const doc = await task.promise;
    return { ok: true, doc, close: () => task.destroy() };
  } catch (error) {
    return { ok: false, reason: classifyError(error) };
  }
}

function classifyError(error: unknown): 'password' | 'invalid' | 'unknown' {
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return 'password';
  if (name === 'InvalidPDFException' || name === 'FormatError') return 'invalid';
  return 'unknown';
}
