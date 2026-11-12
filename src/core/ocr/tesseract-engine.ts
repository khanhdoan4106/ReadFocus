import Tesseract from 'tesseract.js/dist/tesseract.esm.min.js';
import { OCR_LANGUAGES, type OcrWorkerOptions } from './options';
import { toOcrPageResult, type RawOcrPage } from './result';
import type { OcrEngine, OcrInput, OcrPageResult } from './types';

/** OEM của tesseract: chỉ dùng mạng LSTM (dữ liệu `best_int` không có legacy). */
const OEM_LSTM_ONLY = 1;

/**
 * Engine OCR dùng tesseract.js. Worker, core wasm và dữ liệu ngôn ngữ đều lấy
 * từ đường dẫn cục bộ trong `options` (xem `buildOcrOptions`); không có request
 * mạng nào. Tesseract thật không chạy trong unit test: test dùng engine giả.
 */
export async function createTesseractEngine(options: OcrWorkerOptions): Promise<OcrEngine> {
  const worker = await Tesseract.createWorker([...OCR_LANGUAGES], OEM_LSTM_ONLY, options);
  let terminated = false;

  return {
    async recognize(input: OcrInput): Promise<OcrPageResult> {
      if (terminated) throw new Error('OCR worker đã dừng');
      const { data } = await worker.recognize(input.image, {}, { text: true, blocks: true });
      return toOcrPageResult(data as unknown as RawOcrPage, input.width, input.height);
    },
    async terminate(): Promise<void> {
      if (terminated) return;
      terminated = true;
      await worker.terminate();
    },
  };
}
