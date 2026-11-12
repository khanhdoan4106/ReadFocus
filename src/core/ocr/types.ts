/** Hộp bao một từ, tính bằng pixel của ảnh đã render để OCR. */
export type OcrBox = { x0: number; y0: number; x1: number; y1: number };

export type OcrWord = {
  text: string;
  /** 0–100. */
  confidence: number;
  box: OcrBox;
};

/** Kết quả nhận dạng của một trang. */
export type OcrPageResult = {
  text: string;
  /** Độ tin cậy trung bình 0–100 của các từ. */
  confidence: number;
  /** Kích thước ảnh đã đưa vào OCR; cần để đổi hộp bao sang toạ độ trang. */
  width: number;
  height: number;
  words: OcrWord[];
};

export type OcrImage = Blob | HTMLCanvasElement | OffscreenCanvas;

export type OcrInput = {
  image: OcrImage;
  width: number;
  height: number;
};

/**
 * Giao diện engine OCR. Tesseract thật nằm sau giao diện này (xem
 * `tesseract-engine.ts`) nên unit test dùng engine giả.
 */
export interface OcrEngine {
  recognize(input: OcrInput): Promise<OcrPageResult>;
  /** Dừng hẳn worker; gọi được nhiều lần. */
  terminate(): Promise<void>;
}

export type OcrProgress = {
  /** Số trang đã xong (kể cả trang lỗi). */
  done: number;
  total: number;
  /** Trang vừa xong. */
  page: number;
};
