import { LOCAL_CACHE_NAME, type CacheLike } from '../core/embed/local';
import { LocalEmbedClient, type WorkerLike } from '../core/embed/local-client';

/** Worker tạo lười: chỉ khi người dùng tải model hoặc dùng chỉ mục "Trên máy". */
export const localEmbed = new LocalEmbedClient(
  () =>
    new Worker(new URL('../embed-worker/local-embed.worker.ts', import.meta.url), {
      type: 'module',
    }) as unknown as WorkerLike,
);

/** Cache API có trong trang extension; trả `null` ở môi trường không có (ví dụ test). */
export async function openModelCache(): Promise<CacheLike | null> {
  if (typeof caches === 'undefined') return null;
  return caches.open(LOCAL_CACHE_NAME);
}
