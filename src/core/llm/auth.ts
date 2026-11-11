import { LLMError } from './errors';
import type { ProviderConfig } from './types';

/** Key rỗng báo `invalid-key` thay vì gửi request chắc chắn thất bại. */
export function requireApiKey(config: ProviderConfig): string {
  const key = config.apiKey.trim();
  if (key === '') throw new LLMError('invalid-key', 'Missing API key');
  return key;
}
