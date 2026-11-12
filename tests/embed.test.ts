import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGeminiEmbedBody,
  buildOpenAiEmbedBody,
  embedBatch,
  parseGeminiEmbeddings,
  parseOpenAiEmbeddings,
} from '../src/core/embed/api';
import { chunkPages, textHash } from '../src/core/embed/chunk';
import { fuseRankings } from '../src/core/embed/hybrid';
import { embedKey, embedPrefix, embedSupported } from '../src/core/embed/models';
import { chunkForHit, chunkPreview, hybridRetrieve } from '../src/core/embed/retrieve';
import { chunksToEmbed, embeddingId, runEmbedding } from '../src/core/embed/run';
import type { Chunk, EmbeddingRecord } from '../src/core/embed/types';
import { cosine, normalizeVector, rankBySimilarity } from '../src/core/embed/vector';

const words = (n: number, tag = 'w') => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ');

describe('chunkPages', () => {
  it('giữ trang ngắn thành một đoạn và bỏ trang rỗng', () => {
    const chunks = chunkPages([
      { page: 1, text: words(50) },
      { page: 2, text: '   ' },
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ id: '1:0', page: 1, index: 0 });
  });

  it('chia trang dài, gối đầu 40 từ và không vượt trang', () => {
    const chunks = chunkPages([{ page: 3, text: words(700) }]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.page === 3)).toBe(true);
    const first = chunks[0]!.text.split(' ');
    const second = chunks[1]!.text.split(' ');
    expect(first).toHaveLength(300);
    expect(second.slice(0, 40)).toEqual(first.slice(-40));
    // Mọi từ của trang đều nằm trong ít nhất một đoạn.
    const seen = new Set(chunks.flatMap((chunk) => chunk.text.split(' ')));
    expect(seen.size).toBe(700);
  });

  it('không tạo đoạn cuối chỉ gồm phần gối đầu', () => {
    // 300 + 5 từ mới: đoạn cuối quá ngắn nên gộp vào đoạn trước.
    const chunks = chunkPages([{ page: 1, text: words(305) }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text.split(' ')).toHaveLength(305);
  });

  it('đánh số đoạn theo thứ tự trong trang', () => {
    const ids = chunkPages([{ page: 2, text: words(700) }]).map((chunk) => chunk.id);
    expect(ids).toEqual(ids.map((_, i) => `2:${i}`));
  });
});

describe('vector', () => {
  it('cosine: cùng hướng 1, trực giao 0, ngược -1, khác chiều 0', () => {
    expect(cosine([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosine([1, 0], [1, 0, 0])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it('normalizeVector cho độ dài 1 và xử lý vector không', () => {
    const v = normalizeVector([3, 4]);
    expect(Math.hypot(v[0]!, v[1]!)).toBeCloseTo(1);
    expect(Array.from(normalizeVector([0, 0]))).toEqual([0, 0]);
  });

  it('rankBySimilarity xếp giảm dần và cắt theo limit', () => {
    const items = [
      { id: 'a', v: [0, 1] },
      { id: 'b', v: [1, 0.1] },
      { id: 'c', v: [1, 1] },
    ];
    const ranked = rankBySimilarity([1, 0], items, (item) => item.v, 2);
    expect(ranked.map((r) => r.item.id)).toEqual(['b', 'c']);
  });
});

describe('fuseRankings', () => {
  it('đoạn có mặt ở cả hai danh sách lên trước đoạn chỉ đứng đầu một danh sách', () => {
    const fused = fuseRankings([{ keys: ['a', 'b', 'c'] }, { keys: ['d', 'b', 'e'] }], 5);
    expect(fused[0]?.key).toBe('b');
    expect(fused.map((r) => r.key).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('hoà điểm thì giữ thứ tự xuất hiện sớm hơn và tôn trọng limit', () => {
    const fused = fuseRankings([{ keys: ['x'] }, { keys: ['y'] }], 1);
    expect(fused.map((r) => r.key)).toEqual(['x']);
  });

  it('trọng số đổi thứ tự', () => {
    const fused = fuseRankings(
      [
        { keys: ['k'], weight: 1 },
        { keys: ['s'], weight: 3 },
      ],
      2,
    );
    expect(fused[0]?.key).toBe('s');
  });
});

describe('embed models', () => {
  it('tiền tố e5 và nomic đúng thẻ model, model khác không có', () => {
    expect(embedPrefix('multilingual-e5-small', 'query')).toBe('query: ');
    expect(embedPrefix('intfloat/multilingual-e5-small', 'passage')).toBe('passage: ');
    expect(embedPrefix('nomic-embed-text', 'query')).toBe('search_query: ');
    expect(embedPrefix('nomic-embed-text:latest', 'passage')).toBe('search_document: ');
    expect(embedPrefix('text-embedding-3-small', 'query')).toBe('');
  });

  it('khoá nguồn khác nhau theo provider, model và base URL', () => {
    const a = embedKey({ providerId: 'openai', model: 'text-embedding-3-small' });
    const b = embedKey({ providerId: 'openai', model: 'text-embedding-3-large' });
    const c = embedKey({ providerId: 'gemini', model: 'text-embedding-3-small' });
    const d = embedKey({ providerId: 'openai-compatible', model: 'm', baseUrl: 'http://a:1/v1' });
    const e = embedKey({ providerId: 'openai-compatible', model: 'm', baseUrl: 'http://b:1/v1' });
    expect(new Set([a, b, c, d, e]).size).toBe(5);
    expect(embedKey({ providerId: 'openai', model: ' Text-Embedding-3-Small ' })).toBe(a);
  });

  it('Anthropic không hỗ trợ embeddings', () => {
    expect(embedSupported('anthropic')).toBe(false);
    expect(embedSupported('openai')).toBe(true);
  });
});

describe('embedding API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('dựng body OpenAI và Gemini đúng định dạng', () => {
    expect(buildOpenAiEmbedBody('m', ['a', 'b'])).toEqual({
      model: 'm',
      input: ['a', 'b'],
      encoding_format: 'float',
    });
    const gemini = buildGeminiEmbedBody('gemini-embedding-001', ['a'], 'query') as {
      requests: Record<string, unknown>[];
    };
    expect(gemini.requests[0]).toMatchObject({
      model: 'models/gemini-embedding-001',
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768,
      content: { parts: [{ text: 'a' }] },
    });
  });

  it('parse OpenAI theo `index` và chuẩn hoá L2', () => {
    const text = JSON.stringify({
      data: [
        { index: 1, embedding: [0, 2] },
        { index: 0, embedding: [3, 4] },
      ],
    });
    const [first, second] = parseOpenAiEmbeddings(text, 2);
    expect(first![0]).toBeCloseTo(0.6);
    expect(second![1]).toBeCloseTo(1);
  });

  it('báo bad-response khi số vector sai hoặc dữ liệu hỏng', () => {
    expect(() => parseOpenAiEmbeddings(JSON.stringify({ data: [] }), 1)).toThrow();
    expect(() => parseOpenAiEmbeddings('{', 1)).toThrow();
    expect(() =>
      parseGeminiEmbeddings(JSON.stringify({ embeddings: [{ values: ['x'] }] }), 1),
    ).toThrow();
  });

  it('embedBatch OpenAI thêm tiền tố theo model, đặt header auth và không gửi key trong body', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await embedBatch(
      {
        providerId: 'openai-compatible',
        model: 'multilingual-e5-small',
        baseUrl: 'http://localhost:11434',
      },
      { apiKey: '' },
      ['xin chào'],
      'passage',
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/embeddings');
    expect(JSON.parse(String(init.body)).input).toEqual(['passage: xin chào']);
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('embedBatch Gemini dùng header x-goog-api-key, không đưa key vào URL', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ embeddings: [{ values: [1, 1] }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await embedBatch(
      { providerId: 'gemini', model: 'gemini-embedding-001' },
      { apiKey: 'SECRET' },
      ['a'],
      'query',
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('SECRET');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET');
    vi.unstubAllGlobals();
  });

  it('thiếu key OpenAI báo invalid-key mà không gọi mạng', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      embedBatch({ providerId: 'openai', model: 'm' }, { apiKey: ' ' }, ['a'], 'query'),
    ).rejects.toMatchObject({ kind: 'invalid-key' });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

function makeChunks(n: number): Chunk[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${i + 1}:0`,
    page: i + 1,
    index: 0,
    text: `đoạn số ${i}`,
  }));
}

function recordFor(chunk: Chunk, key = 'k'): EmbeddingRecord {
  return {
    id: embeddingId('doc', key, chunk.id),
    docId: 'doc',
    key,
    page: chunk.page,
    chunkId: chunk.id,
    textHash: textHash(chunk.text),
    vector: new Float32Array([1, 0]),
    createdAt: 1,
  };
}

describe('runEmbedding', () => {
  it('chỉ embedding đoạn thiếu hoặc đã đổi nội dung', () => {
    const chunks = makeChunks(3);
    const existing = [recordFor(chunks[0]!), { ...recordFor(chunks[1]!), textHash: 'cũ' }];
    expect(chunksToEmbed(chunks, existing).map((c) => c.id)).toEqual(['2:0', '3:0']);
  });

  it('chạy theo lô, lưu từng lô và báo tiến độ', async () => {
    const chunks = makeChunks(5);
    const embed = vi.fn(async (texts: readonly string[]) => texts.map(() => new Float32Array([1])));
    const saved: number[] = [];
    const progress: number[] = [];

    const result = await runEmbedding({
      docId: 'doc',
      key: 'k',
      chunks,
      existing: [],
      embed,
      signal: new AbortController().signal,
      batchSize: 2,
      onBatch: (records) => void saved.push(records.length),
      onProgress: (p) => void progress.push(p.done),
    });

    expect(embed).toHaveBeenCalledTimes(3);
    expect(saved).toEqual([2, 2, 1]);
    expect(progress).toEqual([0, 2, 4, 5]);
    expect(result).toEqual({ done: 5, total: 5 });
  });

  it('huỷ giữa chừng thì không gửi lô sau và không lưu lô về muộn', async () => {
    const controller = new AbortController();
    const saved: number[] = [];
    const embed = vi.fn(async (texts: readonly string[]) => {
      controller.abort();
      return texts.map(() => new Float32Array([1]));
    });

    await expect(
      runEmbedding({
        docId: 'doc',
        key: 'k',
        chunks: makeChunks(4),
        existing: [],
        embed,
        signal: controller.signal,
        batchSize: 2,
        onBatch: (records) => void saved.push(records.length),
      }),
    ).rejects.toMatchObject({ kind: 'cancelled' });

    expect(embed).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([]);
  });

  it('lỗi ở một lô dừng cả lượt, các lô trước vẫn được lưu', async () => {
    const saved: number[] = [];
    let calls = 0;
    const embed = async (texts: readonly string[]) => {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return texts.map(() => new Float32Array([1]));
    };

    await expect(
      runEmbedding({
        docId: 'doc',
        key: 'k',
        chunks: makeChunks(6),
        existing: [],
        embed,
        signal: new AbortController().signal,
        batchSize: 2,
        onBatch: (records) => void saved.push(records.length),
      }),
    ).rejects.toThrow('boom');
    expect(calls).toBe(2);
    expect(saved).toEqual([2]);
  });
});

describe('hybridRetrieve', () => {
  const chunks: Chunk[] = [
    { id: '1:0', page: 1, index: 0, text: 'mèo ngồi trên thảm' },
    { id: '2:0', page: 2, index: 0, text: 'phương pháp thống kê bayes' },
    { id: '3:0', page: 3, index: 0, text: 'kết luận và hướng phát triển' },
  ];
  const record = (chunk: Chunk, vector: number[]): EmbeddingRecord => ({
    ...recordFor(chunk),
    vector: normalizeVector(vector),
  });
  const records = [
    record(chunks[0]!, [1, 0, 0]),
    record(chunks[1]!, [0, 1, 0]),
    record(chunks[2]!, [0, 0, 1]),
  ];

  it('đoạn khớp ý nghĩa nhưng không khớp từ khoá vẫn được tìm ra', () => {
    const result = hybridRetrieve({
      chunks,
      records,
      queryVector: normalizeVector([0, 0.1, 1]),
      keywordHits: [],
      limit: 2,
    });
    expect(result[0]?.chunk.id).toBe('3:0');
  });

  it('đoạn có cả từ khoá và ý nghĩa xếp trên đoạn chỉ đứng đầu theo ý nghĩa', () => {
    // Ý nghĩa xếp 2:0 trước 3:0, nhưng 3:0 còn khớp từ khoá nên phải lên đầu.
    const result = hybridRetrieve({
      chunks,
      records,
      queryVector: normalizeVector([0, 1, 0.3]),
      keywordHits: [{ page: 3, text: 'kết luận và hướng phát triển' }],
      limit: 3,
    });
    expect(result.map((r) => r.chunk.id)).toEqual(['3:0', '2:0']);
  });

  it('chưa có embedding thì chỉ xếp theo từ khoá', () => {
    const result = hybridRetrieve({
      chunks,
      records: [],
      queryVector: null,
      keywordHits: [{ page: 2, text: 'phương pháp' }],
      limit: 5,
    });
    expect(result.map((r) => r.chunk.id)).toEqual(['2:0']);
  });

  it('bỏ vector của đoạn không còn trong tài liệu', () => {
    const stale = { ...record(chunks[0]!, [1, 0, 0]), chunkId: '9:9' };
    const result = hybridRetrieve({
      chunks,
      records: [stale],
      queryVector: normalizeVector([1, 0, 0]),
      keywordHits: [],
      limit: 3,
    });
    expect(result).toEqual([]);
  });

  it('chunkForHit chọn đúng đoạn chứa nguyên văn trong trang nhiều đoạn', () => {
    const many: Chunk[] = [
      { id: '1:0', page: 1, index: 0, text: 'alpha beta gamma' },
      { id: '1:1', page: 1, index: 1, text: 'delta epsilon zeta' },
    ];
    expect(chunkForHit(many, { page: 1, text: 'delta epsilon' })?.id).toBe('1:1');
    expect(chunkForHit(many, { page: 5, text: 'x' })).toBeNull();
  });
});

describe('chunkPreview', () => {
  it('giữ nguyên đoạn ngắn và cắt đoạn dài theo từ', () => {
    expect(chunkPreview('a  b\nc')).toBe('a b c');
    expect(chunkPreview('a b c d', 2)).toBe('a b…');
  });
});
