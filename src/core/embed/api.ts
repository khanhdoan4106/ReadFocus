import { requireApiKey } from '../llm/auth';
import { badResponse } from '../llm/errors';
import { postJson } from '../llm/http';
import { isRecord, parseJson } from '../llm/json';
import type { ProviderConfig } from '../llm/types';
import { embedBaseUrl, embedPrefix, GEMINI_EMBED_DIMENSIONS } from './models';
import type { EmbedKind, EmbedSource } from './types';
import { normalizeVector } from './vector';

/** Số đoạn tối đa mỗi request: dưới giới hạn 100 của Gemini và 2048 của OpenAI. */
export const EMBED_BATCH_SIZE = 32;

export type EmbedCallOptions = { signal?: AbortSignal };

function toVectors(raw: unknown, expected: number): Float32Array[] {
  if (!Array.isArray(raw) || raw.length !== expected) {
    throw badResponse('Embedding count does not match the request');
  }
  return raw.map((entry) => {
    const values = Array.isArray(entry) ? entry : null;
    if (values === null || values.length === 0 || !values.every((n) => typeof n === 'number')) {
      throw badResponse('Embedding is not a list of numbers');
    }
    return normalizeVector(values as number[]);
  });
}

/** OpenAI và mọi server `/v1/embeddings` tương thích (Ollama, LM Studio). */
export function buildOpenAiEmbedBody(model: string, inputs: readonly string[]) {
  return { model, input: inputs, encoding_format: 'float' };
}

export function parseOpenAiEmbeddings(text: string, expected: number): Float32Array[] {
  const root = parseJson(text);
  const data = isRecord(root) ? root.data : undefined;
  if (!Array.isArray(data)) throw badResponse('No data in embeddings response');

  // `index` cho biết thứ tự; không tin thứ tự mảng khi server trả lộn xộn.
  const ordered = data
    .map((item, position) => ({
      index: isRecord(item) && typeof item.index === 'number' ? item.index : position,
      embedding: isRecord(item) ? item.embedding : undefined,
    }))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
  return toVectors(ordered, expected);
}

export function geminiEmbedEndpoint(model: string): string {
  return `${embedBaseUrl({ providerId: 'gemini', model })}/models/${encodeURIComponent(model)}:batchEmbedContents`;
}

export function buildGeminiEmbedBody(model: string, inputs: readonly string[], kind: EmbedKind) {
  return {
    requests: inputs.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
      outputDimensionality: GEMINI_EMBED_DIMENSIONS,
    })),
  };
}

export function parseGeminiEmbeddings(text: string, expected: number): Float32Array[] {
  const root = parseJson(text);
  const embeddings = isRecord(root) ? root.embeddings : undefined;
  if (!Array.isArray(embeddings)) throw badResponse('No embeddings in response');
  return toVectors(
    embeddings.map((item) => (isRecord(item) ? item.values : undefined)),
    expected,
  );
}

/**
 * Embedding một lô văn bản (≤ `EMBED_BATCH_SIZE`). Thêm tiền tố theo model, gửi
 * một request, trả vector đã chuẩn hoá L2 theo đúng thứ tự đầu vào.
 */
export async function embedBatch(
  source: EmbedSource,
  config: ProviderConfig,
  texts: readonly string[],
  kind: EmbedKind,
  options: EmbedCallOptions = {},
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  if (source.providerId === 'local') {
    throw new Error('Local embeddings are produced by the worker, not by embedBatch');
  }
  const prefix = embedPrefix(source.model, kind);
  const inputs = texts.map((text) => `${prefix}${text}`);

  if (source.providerId === 'gemini') {
    const apiKey = requireApiKey(config);
    const response = await postJson(
      {
        url: geminiEmbedEndpoint(source.model),
        headers: { 'x-goog-api-key': apiKey },
        body: buildGeminiEmbedBody(source.model, inputs, kind),
      },
      options,
    );
    return parseGeminiEmbeddings(response.text, texts.length);
  }

  const apiKey = source.providerId === 'openai' ? requireApiKey(config) : config.apiKey.trim();
  const response = await postJson(
    {
      url: `${embedBaseUrl(source)}/embeddings`,
      headers: apiKey === '' ? {} : { authorization: `Bearer ${apiKey}` },
      body: buildOpenAiEmbedBody(source.model, inputs),
    },
    options,
  );
  return parseOpenAiEmbeddings(response.text, texts.length);
}
