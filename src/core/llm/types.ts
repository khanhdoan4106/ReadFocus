/** Các loại lỗi đã chuẩn hoá để UI dịch thành câu tiếng Việt cụ thể. */
export type LLMErrorKind =
  | 'invalid-key'
  | 'rate-limit'
  | 'quota'
  | 'context-too-long'
  | 'network'
  | 'cancelled'
  | 'bad-response'
  | 'unknown';

export type LLMRequest = {
  /** Hướng dẫn hệ thống; provider tự đặt đúng trường của API. */
  system: string;
  prompt: string;
  model: string;
  maxTokens?: number;
};

export type LLMCallOptions = {
  signal?: AbortSignal;
};

export type ProviderId = 'openai' | 'gemini' | 'anthropic' | 'openai-compatible';

/** Cấu hình người dùng nhập trong Cài đặt → AI. */
export type ProviderConfig = {
  apiKey: string;
  /** Chỉ dùng cho provider OpenAI-compatible (Ollama, LM Studio, gateway nội bộ). */
  baseUrl?: string;
};

export type LLMProvider = {
  id: ProviderId;
  label: string;
  defaultModel: string;
  /** Endpoint gốc mặc định, dùng để xin quyền host và hiển thị. */
  defaultBaseUrl: string;
  complete(request: LLMRequest, config: ProviderConfig, options?: LLMCallOptions): Promise<string>;
  /** Kiểm tra key bằng một request rất nhỏ, không gửi nội dung tài liệu. */
  checkConnection(config: ProviderConfig, model: string, options?: LLMCallOptions): Promise<void>;
};
