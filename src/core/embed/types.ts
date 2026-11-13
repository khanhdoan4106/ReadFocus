import type { ProviderId } from '../llm/types';

/** Anthropic không có API embeddings nên không nằm trong danh sách này. */
export type RemoteEmbedProviderId = Exclude<ProviderId, 'anthropic'>;

/** Nguồn embedding: một provider có API embeddings, hoặc model chạy trên máy. */
export type EmbedProviderId = RemoteEmbedProviderId | 'local';

/** Nguồn embedding: provider + model (+ base URL với OpenAI-compatible). */
export type EmbedSource = {
  providerId: EmbedProviderId;
  model: string;
  /** Chỉ có nghĩa với `openai-compatible`; hai server khác nhau không dùng chung vector. */
  baseUrl?: string;
};

/** `query` cho câu hỏi/từ khoá tìm kiếm, `passage` cho đoạn văn của tài liệu. */
export type EmbedKind = 'query' | 'passage';

/** Một đoạn văn bản thuộc đúng một trang, để trích dẫn trang luôn xác định. */
export type Chunk = {
  /** Ổn định theo (trang, thứ tự trong trang). */
  id: string;
  page: number;
  index: number;
  text: string;
};

export type EmbeddingRecord = {
  id: string;
  docId: string;
  /** Khoá nguồn (`embedKey`) — vector khác khoá không bao giờ dùng lẫn. */
  key: string;
  page: number;
  chunkId: string;
  /** Băm nội dung đoạn; đoạn đổi (ví dụ sau OCR) thì vector cũ bị bỏ. */
  textHash: string;
  vector: Float32Array;
  createdAt: number;
};

export type EmbedProgress = { done: number; total: number };
