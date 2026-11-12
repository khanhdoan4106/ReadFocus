export type Citation = {
  page: number;
  quote: string;
};

/** Câu trả lời đã phân tích từ JSON của model (chưa kiểm tra trích dẫn). */
export type ParsedAnswer = {
  answer: string;
  citations: Citation[];
  found: boolean;
  /** `false` khi model không trả JSON hợp lệ và ta dùng cả câu trả lời làm văn bản. */
  structured: boolean;
};

export type VerifiedAnswer = {
  answer: string;
  found: boolean;
  /** Chỉ gồm trích dẫn có trang trong ngữ cảnh đã gửi và quote nằm trong trang đó. */
  citations: Citation[];
  /** Số trích dẫn bị bỏ vì sai trang hoặc quote không có trong trang. */
  dropped: number;
  /** Có trích dẫn không kiểm chứng được, hoặc câu trả lời không kèm trích dẫn nào hợp lệ. */
  unverified: boolean;
};

export type QaRecord = {
  id: string;
  docId: string;
  question: string;
  answer: string;
  found: boolean;
  citations: Citation[];
  unverified: boolean;
  providerId: string;
  model: string;
  promptVersion: number;
  createdAt: number;
};
