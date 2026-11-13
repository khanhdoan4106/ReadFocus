import { describe, expect, it } from 'vitest';
import {
  LocalEmbedError,
  type LocalWorkerRequest,
  type LocalWorkerResponse,
} from '../src/core/embed/local';
import { LocalEmbedClient, type WorkerLike } from '../src/core/embed/local-client';

/** Worker giả: ghi lại tin nhắn, test tự quyết định khi nào và trả lời gì. */
class FakeWorker implements WorkerLike {
  sent: LocalWorkerRequest[] = [];
  terminated = false;
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  postMessage(message: LocalWorkerRequest): void {
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(message: LocalWorkerResponse): void {
    this.onmessage?.({ data: message });
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const client = new LocalEmbedClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { client, workers, last: () => workers[workers.length - 1] as FakeWorker };
}

const live = () => new AbortController().signal;
const vec = (...n: number[]) => new Float32Array(n);

describe('LocalEmbedClient', () => {
  it('không tạo worker cho tới khi cần', () => {
    const { workers } = setup();
    expect(workers).toHaveLength(0);
  });

  it('chỉ lệnh download() mới xin phép tải; load() và embed() luôn cấm mạng', async () => {
    const { client, last } = setup();
    const progress: number[] = [];

    const downloading = client.download(live(), (p) => progress.push(p.loaded));
    expect(last().sent[0]).toMatchObject({ type: 'load', download: true });
    last().reply({ type: 'progress', id: 1, loaded: 10, total: 100 });
    last().reply({ type: 'loaded', id: 1 });
    await downloading;
    expect(progress).toEqual([10]);
    expect(client.isLoaded).toBe(true);

    // Đã nạp rồi thì embed không cần nạp lại, và không có lệnh `download: true` nào nữa.
    const embedding = client.embed(['a'], 'passage', live());
    await Promise.resolve();
    last().reply({ type: 'vectors', id: 2, vectors: [vec(1, 0)] });
    await embedding;
    expect(last().sent.filter((m) => m.type === 'load' && m.download)).toHaveLength(1);
  });

  it('embed nạp từ cache (download:false) và thêm tiền tố query:/passage:', async () => {
    const { client, last } = setup();
    const query = client.embed(['xin chào'], 'query', live());
    expect(last().sent[0]).toMatchObject({ type: 'load', download: false });
    last().reply({ type: 'loaded', id: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(last().sent[1]).toEqual({ type: 'embed', id: 2, texts: ['query: xin chào'] });
    last().reply({ type: 'vectors', id: 2, vectors: [vec(1)] });
    expect(await query).toEqual([vec(1)]);

    const passage = client.embed(['đoạn'], 'passage', live());
    await Promise.resolve();
    expect(last().sent[2]).toEqual({ type: 'embed', id: 3, texts: ['passage: đoạn'] });
    last().reply({ type: 'vectors', id: 3, vectors: [vec(2)] });
    await passage;
  });

  it('chưa tải model thì báo not-downloaded, không gọi mạng', async () => {
    const { client, last } = setup();
    const embedding = client.embed(['a'], 'passage', live());
    last().reply({ type: 'error', id: 1, code: 'not-downloaded', message: 'missing' });
    await expect(embedding).rejects.toMatchObject({ code: 'not-downloaded' });
    expect(client.isLoaded).toBe(false);
  });

  it('huỷ khi đang tải thì dừng worker và báo cancelled; lần sau tạo worker mới', async () => {
    const { client, workers, last } = setup();
    const abort = new AbortController();
    const downloading = client.download(abort.signal, () => undefined);
    abort.abort();
    await expect(downloading).rejects.toMatchObject({ code: 'cancelled' });
    expect(last().terminated).toBe(true);
    expect(client.isLoaded).toBe(false);

    void client.download(live(), () => undefined).catch(() => undefined);
    expect(workers).toHaveLength(2);
  });

  it('đã huỷ sẵn thì không gửi gì', async () => {
    const { client, workers } = setup();
    const abort = new AbortController();
    abort.abort();
    await expect(client.download(abort.signal, () => undefined)).rejects.toBeInstanceOf(
      LocalEmbedError,
    );
    expect(workers).toHaveLength(0);
  });

  it('huỷ một lượt embed không dừng worker (model vẫn ở trong bộ nhớ)', async () => {
    const { client, last } = setup();
    const loading = client.load(live());
    last().reply({ type: 'loaded', id: 1 });
    await loading;

    const abort = new AbortController();
    const embedding = client.embed(['a'], 'passage', abort.signal);
    await Promise.resolve();
    abort.abort();
    await expect(embedding).rejects.toMatchObject({ code: 'cancelled' });
    expect(last().terminated).toBe(false);
    expect(client.isLoaded).toBe(true);
  });

  it('worker lỗi thì mọi việc đang chờ bị từ chối và worker được bỏ', async () => {
    const { client, last } = setup();
    const embedding = client.embed(['a'], 'passage', live());
    last().onerror?.({ message: 'boom' });
    await expect(embedding).rejects.toMatchObject({ code: 'run-failed' });
    expect(last().terminated).toBe(true);
  });

  it('số vector không khớp số văn bản là lỗi', async () => {
    const { client, last } = setup();
    const loading = client.load(live());
    last().reply({ type: 'loaded', id: 1 });
    await loading;
    const embedding = client.embed(['a', 'b'], 'passage', live());
    await Promise.resolve();
    last().reply({ type: 'vectors', id: 2, vectors: [vec(1)] });
    await expect(embedding).rejects.toMatchObject({ code: 'run-failed' });
  });
});
