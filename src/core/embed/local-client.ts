import { embedPrefix } from './models';
import {
  LocalEmbedError,
  LOCAL_MODEL_ID,
  type DownloadProgress,
  type LocalWorkerRequest,
  type LocalWorkerResponse,
} from './local';
import type { EmbedKind } from './types';

/** Phần của `Worker` mà client dùng; đồ giả trong test cũng thoả mãn. */
export type WorkerLike = {
  postMessage(message: LocalWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: { data: LocalWorkerResponse }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
};

type RequestBody = { type: 'load'; download: boolean } | { type: 'embed'; texts: string[] };

type Pending = {
  resolve: (value: LocalWorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: DownloadProgress) => void;
};

/**
 * Điều khiển worker embedding trên máy. Chỉ lệnh `download: true` (do người dùng bấm và
 * đồng ý) mới được phép gọi mạng; mọi lệnh khác chỉ đọc cache.
 */
export class LocalEmbedClient {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private loaded = false;

  constructor(private readonly createWorker: () => WorkerLike) {}

  get isLoaded(): boolean {
    return this.loaded;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker !== null) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => {
      const message = event.data;
      const entry = this.pending.get(message.id);
      if (entry === undefined) return;
      if (message.type === 'progress') {
        entry.onProgress?.({ loaded: message.loaded, total: message.total });
        return;
      }
      this.pending.delete(message.id);
      if (message.type === 'error') {
        entry.reject(new LocalEmbedError(message.code, message.message));
      } else {
        entry.resolve(message);
      }
    };
    worker.onerror = (event) => {
      this.failAll(new LocalEmbedError('run-failed', event.message ?? 'Worker error'));
      this.dispose();
    };
    this.worker = worker;
    return worker;
  }

  private failAll(error: Error): void {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const entry of entries) entry.reject(error);
  }

  /** Dừng worker (và việc tải dở); model đã nằm trong cache không bị ảnh hưởng. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.loaded = false;
  }

  private request(
    message: RequestBody,
    signal: AbortSignal,
    options: { onProgress?: (progress: DownloadProgress) => void; killOnAbort: boolean },
  ): Promise<LocalWorkerResponse> {
    if (signal.aborted) return Promise.reject(new LocalEmbedError('cancelled', 'Aborted'));
    const worker = this.ensureWorker();
    const id = this.nextId++;

    return new Promise<LocalWorkerResponse>((resolve, reject) => {
      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const onAbort = () => {
        this.pending.delete(id);
        reject(new LocalEmbedError('cancelled', 'Aborted'));
        // Tải dở không huỷ được từng phần: dừng cả worker, lần sau tạo lại.
        if (options.killOnAbort) {
          this.failAll(new LocalEmbedError('cancelled', 'Aborted'));
          this.dispose();
        }
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.pending.set(id, {
        resolve: (value) => {
          cleanup();
          resolve(value);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
        onProgress: options.onProgress,
      });
      worker.postMessage({ ...message, id } as LocalWorkerRequest);
    });
  }

  /** Tải model từ Hugging Face (chỉ gọi sau khi người dùng đồng ý) rồi nạp vào bộ nhớ. */
  async download(
    signal: AbortSignal,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<void> {
    await this.request({ type: 'load', download: true }, signal, { onProgress, killOnAbort: true });
    this.loaded = true;
  }

  /** Nạp model đã có trong cache, không bao giờ gọi mạng. Ném `not-downloaded` nếu thiếu. */
  async load(signal: AbortSignal): Promise<void> {
    if (this.loaded) return;
    await this.request({ type: 'load', download: false }, signal, { killOnAbort: false });
    this.loaded = true;
  }

  /** Embedding một lô văn bản: thêm tiền tố theo thẻ model, trả vector đã chuẩn hoá. */
  async embed(
    texts: readonly string[],
    kind: EmbedKind,
    signal: AbortSignal,
  ): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    await this.load(signal);
    const prefix = embedPrefix(LOCAL_MODEL_ID, kind);
    const response = await this.request(
      { type: 'embed', texts: texts.map((text) => `${prefix}${text}`) },
      signal,
      { killOnAbort: false },
    );
    if (response.type !== 'vectors' || response.vectors.length !== texts.length) {
      throw new LocalEmbedError('run-failed', 'Embedding count does not match the request');
    }
    return response.vectors;
  }
}
