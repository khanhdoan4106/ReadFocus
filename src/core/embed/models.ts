import { normalizeBaseUrl } from '../llm/http';
import { GEMINI_BASE_URL, OPENAI_BASE_URL, OPENAI_COMPATIBLE_BASE_URL } from '../llm/models';
import type { ProviderId } from '../llm/types';
import { LOCAL_MODEL_ID } from './local';
import type { EmbedKind, EmbedProviderId, EmbedSource, RemoteEmbedProviderId } from './types';

/**
 * Model embedding mặc định, kiểm tra ngày 12/11/2026:
 * - OpenAI: `text-embedding-3-small`, 1536 chiều, tối đa 8192 token mỗi đầu vào
 *   (https://developers.openai.com/api/docs/guides/embeddings).
 * - Gemini: `gemini-embedding-001` (chỉ văn bản, hỗ trợ `taskType`; model mới
 *   `gemini-embedding-2` bỏ `task_type`), mặc định 3072 chiều, cho phép 128–3072
 *   (https://aistudio.google.com/docs/embeddings). ReadFocus xin 768 chiều.
 * - OpenAI-compatible: `nomic-embed-text` (thẻ phổ biến của Ollama).
 */
export const EMBED_DEFAULT_MODELS: Record<EmbedProviderId, string> = {
  openai: 'text-embedding-3-small',
  gemini: 'gemini-embedding-001',
  'openai-compatible': 'nomic-embed-text',
  local: LOCAL_MODEL_ID,
};

export const GEMINI_EMBED_DIMENSIONS = 768;

/** Tăng khi cách chia đoạn hoặc tiền tố đổi, để vector cũ không dùng lẫn. */
export const EMBED_VERSION = 1;

export function embedSupported(providerId: ProviderId): providerId is RemoteEmbedProviderId {
  return providerId !== 'anthropic';
}

/** Model rỗng thì dùng model mặc định của provider. */
export function resolveEmbedModel(providerId: RemoteEmbedProviderId, model: string): string {
  const trimmed = model.trim();
  return trimmed === '' ? EMBED_DEFAULT_MODELS[providerId] : trimmed;
}

export function embedBaseUrl(source: EmbedSource): string {
  if (source.providerId === 'local') return '';
  if (source.providerId === 'openai') return OPENAI_BASE_URL;
  if (source.providerId === 'gemini') return GEMINI_BASE_URL;
  return normalizeBaseUrl(source.baseUrl, OPENAI_COMPATIBLE_BASE_URL);
}

/**
 * Khoá nguồn của vector. Khác provider, model, base URL (server tương thích) hay
 * phiên bản chia đoạn thì khoá khác nên không bao giờ dùng lẫn vector.
 */
export function embedKey(source: EmbedSource): string {
  const base = source.providerId === 'openai-compatible' ? embedBaseUrl(source) : '';
  return [source.providerId, source.model.trim().toLowerCase(), base, `v${EMBED_VERSION}`].join(
    '|',
  );
}

/**
 * Tiền tố theo thẻ model. Họ e5 bắt buộc `query: ` / `passage: ` (thẻ
 * `intfloat/multilingual-e5-small`); nomic-embed-text dùng `search_query: ` /
 * `search_document: `. Model khác không cần tiền tố.
 */
export function embedPrefix(model: string, kind: EmbedKind): string {
  const name = model.trim().toLowerCase();
  if (/(^|[/_-])e5([/_-]|$)/.test(name) || name.includes('multilingual-e5')) {
    return kind === 'query' ? 'query: ' : 'passage: ';
  }
  if (name.startsWith('nomic-embed-text')) {
    return kind === 'query' ? 'search_query: ' : 'search_document: ';
  }
  return '';
}

/** Nguồn đang chọn trong Cài đặt: `null` khi provider không có embeddings và không chọn "Trên máy". */
export function resolveEmbedSource(settings: {
  providerId: ProviderId;
  embedSource: 'provider' | 'local';
  embedModel: string;
  baseUrl: string;
}): EmbedSource | null {
  if (settings.embedSource === 'local') return { providerId: 'local', model: LOCAL_MODEL_ID };
  const { providerId } = settings;
  if (!embedSupported(providerId)) return null;
  return {
    providerId,
    model: resolveEmbedModel(providerId, settings.embedModel),
    baseUrl: providerId === 'openai-compatible' ? settings.baseUrl : undefined,
  };
}
