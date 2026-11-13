/// <reference lib="webworker" />
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import {
  createProgressTracker,
  LOCAL_MODEL_DTYPE,
  LOCAL_MODEL_ID,
  LOCAL_MODEL_REVISION,
  type LocalErrorCode,
  type LocalWorkerRequest,
  type LocalWorkerResponse,
} from '../core/embed/local';

/** Khớp `ORT_ASSET_DIR` trong vite-plugins/hf-assets.ts. */
const ORT_DIR = 'ort';

const post = (message: LocalWorkerResponse, transfer: Transferable[] = []): void => {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer);
};

/** Luôn trỏ vào gói extension (chrome-extension://…); không bao giờ dùng đường dẫn CDN mặc định. */
function ortUrl(file: string): string {
  return new URL(`/${ORT_DIR}/${file}`, self.location.href).href;
}

// Phải bật: transformers.js từ chối khi cả hai nguồn cùng tắt. Địa chỉ model là URL nên
// không bao giờ đọc đường dẫn cục bộ; nguồn từ xa chỉ bật trong lúc tải (xem `load`).
env.allowLocalModels = true;
// Ghim commit trong đường dẫn: mọi file (kể cả những lần tải không truyền `revision`) cùng một khoá cache.
env.remotePathTemplate = `{model}/resolve/${LOCAL_MODEL_REVISION}/`;
env.useBrowserCache = true; // Cache API: tải một lần, các lần sau dùng offline.
env.useWasmCache = false; // Tránh nạp runtime qua blob URL (CSP của extension chặn).
const onnx = env.backends.onnx;
if (onnx.wasm) {
  onnx.wasm.wasmPaths = {
    mjs: ortUrl('ort-wasm-simd-threaded.mjs'),
    wasm: ortUrl('ort-wasm-simd-threaded.wasm'),
  };
  onnx.wasm.numThreads = 1; // Trang extension không có cross-origin isolation.
}

let extractor: FeatureExtractionPipeline | null = null;

async function load(id: number, download: boolean): Promise<void> {
  if (extractor !== null) {
    post({ type: 'loaded', id });
    return;
  }
  // `download: false` thì cấm hẳn mạng, hai lớp: tắt nguồn từ xa của thư viện và chặn `fetch`
  // (kể cả các request kiểm tra kích thước/tồn tại). Thiếu file trong cache thì báo chưa tải.
  env.allowRemoteModels = download;
  const realFetch = env.fetch;
  if (!download) {
    env.fetch = () =>
      Promise.reject(new Error('Network access is disabled for the on-device model'));
  }
  const tracker = createProgressTracker();
  try {
    extractor = (await pipeline('feature-extraction', LOCAL_MODEL_ID, {
      dtype: LOCAL_MODEL_DTYPE,
      device: 'wasm',
      progress_callback: (event: unknown) => {
        const { loaded, total } = tracker.update(event);
        post({ type: 'progress', id, loaded, total });
      },
    })) as FeatureExtractionPipeline;
    post({ type: 'loaded', id });
  } catch (error) {
    post({
      type: 'error',
      id,
      code: (download ? 'download-failed' : 'not-downloaded') satisfies LocalErrorCode,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    env.allowRemoteModels = false;
    env.fetch = realFetch;
  }
}

async function embed(id: number, texts: string[]): Promise<void> {
  if (extractor === null) {
    post({ type: 'error', id, code: 'not-downloaded', message: 'Model is not loaded' });
    return;
  }
  try {
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const [count, dims] = output.dims as [number, number];
    const data = output.data as Float32Array;
    const vectors: Float32Array[] = [];
    for (let i = 0; i < count; i += 1) vectors.push(data.slice(i * dims, (i + 1) * dims));
    post(
      { type: 'vectors', id, vectors },
      vectors.map((vector) => vector.buffer),
    );
  } catch (error) {
    post({
      type: 'error',
      id,
      code: 'run-failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

self.onmessage = (event: MessageEvent<LocalWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'load') void load(request.id, request.download);
  else void embed(request.id, request.texts);
};
