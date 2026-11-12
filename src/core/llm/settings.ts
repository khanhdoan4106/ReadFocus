import { DEFAULT_MODELS } from './models';
import type { ProviderId } from './types';

export type SummaryLanguage = 'vi' | 'document';

/**
 * Tuỳ chọn AI lưu trong `chrome.storage.local`. Key không nằm ở đây; key có
 * store riêng để bật/tắt "không lưu key" mà không mất các tuỳ chọn khác.
 */
export type AiSettings = {
  providerId: ProviderId;
  model: string;
  /** Model embedding (tìm theo ý nghĩa, hỏi đáp); rỗng thì dùng mặc định của provider. */
  embedModel: string;
  /** Chỉ dùng cho `openai-compatible`. */
  baseUrl: string;
  /** `false` nghĩa là key chỉ nằm trong `chrome.storage.session`. */
  saveKey: boolean;
  language: SummaryLanguage;
  /** Đã xác nhận hộp thoại "nội dung sẽ được gửi tới nhà cung cấp" chưa. */
  consentGiven: boolean;
};

const PROVIDER_IDS: readonly ProviderId[] = ['openai', 'gemini', 'anthropic', 'openai-compatible'];

/** Thứ tự hiển thị trong Cài đặt → AI. */
export const PROVIDERS: readonly ProviderId[] = PROVIDER_IDS;

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}

/** Ba provider đám mây bắt buộc key; Ollama/LM Studio chạy nội bộ thì không. */
export function providerRequiresKey(providerId: ProviderId): boolean {
  return providerId !== 'openai-compatible';
}

/**
 * Kiểm tra tối thiểu trước khi gọi mạng từ giao diện. Chỉ thiếu key mới chặn;
 * model rỗng đã được `sanitizeAiSettings` thay bằng model mặc định.
 */
export function aiConfigProblem(settings: AiSettings, apiKey: string): 'missing-key' | null {
  if (providerRequiresKey(settings.providerId) && apiKey.trim() === '') {
    return 'missing-key';
  }
  return null;
}

export function defaultAiSettings(): AiSettings {
  return {
    providerId: 'openai',
    model: DEFAULT_MODELS.openai,
    embedModel: '',
    baseUrl: '',
    saveKey: true,
    language: 'vi',
    consentGiven: false,
  };
}

/**
 * Chuẩn hoá dữ liệu đọc từ storage: giá trị lạ được thay bằng mặc định thay vì
 * làm hỏng giao diện. Model rỗng được thay bằng model mặc định của provider.
 */
export function sanitizeAiSettings(raw: unknown): AiSettings {
  const fallback = defaultAiSettings();
  if (typeof raw !== 'object' || raw === null) return fallback;

  const value = raw as Record<string, unknown>;
  const providerId = isProviderId(value.providerId) ? value.providerId : fallback.providerId;
  const model =
    typeof value.model === 'string' && value.model.trim() !== ''
      ? value.model.trim()
      : DEFAULT_MODELS[providerId];
  const language: SummaryLanguage = value.language === 'document' ? 'document' : 'vi';

  return {
    providerId,
    model,
    embedModel: typeof value.embedModel === 'string' ? value.embedModel.trim() : '',
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '',
    saveKey: typeof value.saveKey === 'boolean' ? value.saveKey : true,
    language,
    consentGiven: value.consentGiven === true,
  };
}
