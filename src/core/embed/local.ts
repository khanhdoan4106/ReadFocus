/**
 * Embedding chạy trên máy (nhóm L). Phần thuần: hằng số model, địa chỉ file, kiểm tra
 * và xoá cache, gộp tiến độ tải, giao thức tin nhắn giữa trang và worker.
 *
 * Model: `Xenova/multilingual-e5-small` (bản ONNX của `intfloat/multilingual-e5-small`,
 * giấy phép MIT, hỗ trợ tiếng Việt), lượng tử hoá 8 bit, 384 chiều. Kích thước các file
 * lấy từ API Hugging Face ngày 13/11/2026:
 * https://huggingface.co/api/models/Xenova/multilingual-e5-small?blobs=true
 * Thẻ model yêu cầu tiền tố `query: ` / `passage: ` (xem `embedPrefix`).
 */
export const LOCAL_MODEL_ID = 'Xenova/multilingual-e5-small';

/** Ghim đúng commit để người dùng luôn tải cùng một bản đã kiểm tra. */
export const LOCAL_MODEL_REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';

export const LOCAL_MODEL_DTYPE = 'q8';
export const LOCAL_MODEL_DIMENSIONS = 384;

/** Nguồn tải trọng số; chỉ truy cập sau khi người dùng đồng ý. */
export const LOCAL_MODEL_HOST = 'https://huggingface.co/';

/** Tên cache mặc định của transformers.js (Cache API). */
export const LOCAL_CACHE_NAME = 'transformers-cache';

/** Embedding trên máy chạy từng lô nhỏ để không giữ nhiều bộ nhớ. */
export const LOCAL_EMBED_BATCH_SIZE = 8;

/** Dung lượng hiển thị cho người dùng, làm tròn theo MiB và gọi là MB. */
export function formatModelSize(bytes: number): string {
  return `${Math.round(bytes / 1_048_576)} MB`;
}

export type LocalModelFile = { path: string; bytes: number };

/** Các file thật sự được tải với `dtype: 'q8'`. */
export const LOCAL_MODEL_FILES: readonly LocalModelFile[] = [
  { path: 'onnx/model_quantized.onnx', bytes: 118_308_185 },
  { path: 'tokenizer.json', bytes: 17_082_730 },
  { path: 'tokenizer_config.json', bytes: 443 },
  { path: 'config.json', bytes: 658 },
];

export const LOCAL_MODEL_BYTES = LOCAL_MODEL_FILES.reduce((sum, file) => sum + file.bytes, 0);

export function localModelFileUrl(file: LocalModelFile): string {
  return `${LOCAL_MODEL_HOST}${LOCAL_MODEL_ID}/resolve/${LOCAL_MODEL_REVISION}/${file.path}`;
}

/** Phần cần của Cache API mà code dùng; `Cache` thật thoả mãn kiểu này. */
export type CacheLike = {
  match(request: string): Promise<Response | undefined>;
  delete(request: string): Promise<boolean>;
};

/** Đủ mọi file thì model dùng được offline. */
export async function isModelCached(cache: CacheLike): Promise<boolean> {
  for (const file of LOCAL_MODEL_FILES) {
    if ((await cache.match(localModelFileUrl(file))) === undefined) return false;
  }
  return true;
}

/** Xoá mọi file của model; trả về số file đã xoá. */
export async function deleteModelFiles(cache: CacheLike): Promise<number> {
  let removed = 0;
  for (const file of LOCAL_MODEL_FILES) {
    if (await cache.delete(localModelFileUrl(file))) removed += 1;
  }
  return removed;
}

export type DownloadProgress = { loaded: number; total: number };

/**
 * Gộp sự kiện `progress_callback` của transformers.js thành tiến độ chung. Tổng dùng
 * kích thước đã biết trước nên thanh không nhảy lùi khi file sau mới bắt đầu tải.
 */
export function createProgressTracker(): {
  update(event: unknown): DownloadProgress;
  current(): DownloadProgress;
} {
  const loadedByFile = new Map<string, number>();
  const knownSize = new Map(LOCAL_MODEL_FILES.map((file) => [file.path, file.bytes]));

  const current = (): DownloadProgress => {
    let loaded = 0;
    for (const [path, value] of loadedByFile) {
      const size = knownSize.get(path);
      loaded += size === undefined ? 0 : Math.min(value, size);
    }
    return { loaded, total: LOCAL_MODEL_BYTES };
  };

  return {
    current,
    update(event) {
      if (typeof event === 'object' && event !== null) {
        const { status, file, loaded } = event as Record<string, unknown>;
        if (typeof file === 'string') {
          if (status === 'done') loadedByFile.set(file, knownSize.get(file) ?? 0);
          else if (status === 'progress' && typeof loaded === 'number') {
            loadedByFile.set(file, loaded);
          }
        }
      }
      return current();
    },
  };
}

/** Tin nhắn trang → worker. `download: false` nghĩa là chỉ được đọc từ cache, không gọi mạng. */
export type LocalWorkerRequest =
  { type: 'load'; id: number; download: boolean } | { type: 'embed'; id: number; texts: string[] };

export type LocalErrorCode = 'not-downloaded' | 'download-failed' | 'run-failed';

/** Tin nhắn worker → trang. */
export type LocalWorkerResponse =
  | { type: 'progress'; id: number; loaded: number; total: number }
  | { type: 'loaded'; id: number }
  | { type: 'vectors'; id: number; vectors: Float32Array[] }
  | { type: 'error'; id: number; code: LocalErrorCode; message: string };

export class LocalEmbedError extends Error {
  readonly code: LocalErrorCode | 'cancelled';
  constructor(code: LocalErrorCode | 'cancelled', message: string) {
    super(message);
    this.name = 'LocalEmbedError';
    this.code = code;
  }
}
