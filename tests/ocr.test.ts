import { describe, expect, it } from 'vitest';
import { boxToPageRect } from '../src/core/ocr/geometry';
import { buildOcrOptions } from '../src/core/ocr/options';
import {
  averageConfidence,
  buildOcrPageRecords,
  defaultOcrRange,
  hasTextLayer,
  isLowConfidence,
  pagesToRecognize,
  validateOcrRange,
} from '../src/core/ocr/pages';
import { toOcrPageResult } from '../src/core/ocr/result';
import { runOcr, withOcrEngine } from '../src/core/ocr/run';
import type { OcrEngine, OcrInput, OcrPageResult } from '../src/core/ocr/types';

function result(text: string, confidence = 90): OcrPageResult {
  return { text, confidence, width: 1000, height: 1400, words: [] };
}

const input: OcrInput = { image: new Blob(['x']), width: 1000, height: 1400 };

class FakeEngine implements OcrEngine {
  recognized: number[] = [];
  terminated = 0;
  private current = 0;
  constructor(private readonly behave: (call: number) => Promise<OcrPageResult>) {}
  async recognize(): Promise<OcrPageResult> {
    this.current += 1;
    this.recognized.push(this.current);
    return this.behave(this.current);
  }
  async terminate(): Promise<void> {
    this.terminated += 1;
  }
}

describe('buildOcrOptions', () => {
  it('trả về URL của extension cho worker, core và dữ liệu ngôn ngữ', () => {
    const options = buildOcrOptions((path) => `chrome-extension://abc/${path}`);

    expect(options).toEqual({
      workerPath: 'chrome-extension://abc/ocr/worker.min.js',
      corePath: 'chrome-extension://abc/ocr/core',
      langPath: 'chrome-extension://abc/ocr/lang',
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
    });
  });

  it('không có đường dẫn nào trỏ ra ngoài extension', () => {
    const options = buildOcrOptions((path) => `chrome-extension://abc/${path}`);
    for (const value of [options.workerPath, options.corePath, options.langPath]) {
      expect(value.startsWith('chrome-extension://abc/')).toBe(true);
    }
  });
});

describe('defaultOcrRange', () => {
  it('lấy trang đang đọc ± 2 trang', () => {
    expect(defaultOcrRange(10, 50)).toEqual({ from: 8, to: 12 });
  });

  it('kẹp theo đầu và cuối tài liệu', () => {
    expect(defaultOcrRange(1, 50)).toEqual({ from: 1, to: 3 });
    expect(defaultOcrRange(50, 50)).toEqual({ from: 48, to: 50 });
    expect(defaultOcrRange(99, 3)).toEqual({ from: 1, to: 3 });
  });

  it('không vượt quá số trang tối đa', () => {
    expect(defaultOcrRange(50, 500, 80, 100)).toEqual({ from: 1, to: 100 });
  });
});

describe('validateOcrRange', () => {
  it('chấp nhận khoảng hợp lệ', () => {
    expect(validateOcrRange(3, 10, 20)).toEqual({ ok: true, range: { from: 3, to: 10 } });
  });

  it('từ chối khoảng sai, ngoài tài liệu và quá dài', () => {
    expect(validateOcrRange(5, 3, 20)).toEqual({ ok: false, error: 'invalid' });
    expect(validateOcrRange(1.5, 3, 20)).toEqual({ ok: false, error: 'invalid' });
    expect(validateOcrRange(0, 3, 20)).toEqual({ ok: false, error: 'out-of-bounds' });
    expect(validateOcrRange(1, 21, 20)).toEqual({ ok: false, error: 'out-of-bounds' });
    expect(validateOcrRange(1, 101, 500)).toEqual({ ok: false, error: 'too-long' });
    expect(validateOcrRange(1, 100, 500).ok).toBe(true);
  });
});

describe('pagesToRecognize', () => {
  const existing = [
    { page: 1, text: 'Trang có lớp chữ đầy đủ' },
    { page: 2, text: '   ' },
    { page: 3, text: 'Chữ cũ từ OCR lần trước', source: 'ocr' as const },
  ];

  it('bỏ trang đã có lớp chữ, giữ trang trống, trang OCR cũ và trang chưa có', () => {
    expect(pagesToRecognize({ from: 1, to: 4 }, existing)).toEqual([2, 3, 4]);
  });

  it('force nhận dạng lại tất cả trang trong khoảng', () => {
    expect(pagesToRecognize({ from: 1, to: 3 }, existing, true)).toEqual([1, 2, 3]);
  });

  it('hasTextLayer cần đủ ký tự không phải khoảng trắng', () => {
    expect(hasTextLayer({ page: 1, text: '12345' })).toBe(false);
    expect(hasTextLayer({ page: 1, text: 'đủ mười ký tự rồi' })).toBe(true);
    expect(hasTextLayer(undefined)).toBe(false);
  });
});

describe('averageConfidence', () => {
  it('lấy trung bình các từ không rỗng và kẹp trong 0–100', () => {
    expect(
      averageConfidence([
        { text: 'a', confidence: 80 },
        { text: 'b', confidence: 100 },
        { text: ' ', confidence: 0 },
        { text: 'c', confidence: 250 },
      ]),
    ).toBe(93.3);
    expect(averageConfidence([])).toBe(0);
  });

  it('đánh dấu độ tin cậy thấp dưới 60', () => {
    expect(isLowConfidence(59.9)).toBe(true);
    expect(isLowConfidence(60)).toBe(false);
    expect(isLowConfidence(undefined)).toBe(false);
  });
});

describe('toOcrPageResult', () => {
  it('gom từ của mọi khối, bỏ từ rỗng hoặc có hộp bao hỏng, chuẩn hoá NFC', () => {
    const decomposed = 'Chương'.normalize('NFD');
    const page = toOcrPageResult(
      {
        text: `  ${decomposed} một \n`,
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      {
                        text: decomposed,
                        confidence: 90,
                        bbox: { x0: 10, y0: 20, x1: 80, y1: 40 },
                      },
                      { text: '  ', confidence: 95, bbox: { x0: 1, y0: 1, x1: 2, y1: 2 } },
                      { text: 'hỏng', confidence: 95, bbox: { x0: 5, y0: 5, x1: 5, y1: 9 } },
                      { text: 'thiếu', confidence: 95 },
                    ],
                  },
                ],
              },
            ],
          },
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: 'một', confidence: 70, bbox: { x0: 90, y0: 20, x1: 130, y1: 40 } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      800,
      1100,
    );

    expect(page.text).toBe('Chương một');
    expect(page.words.map((word) => word.text)).toEqual(['Chương', 'một']);
    expect(page.confidence).toBe(80);
    expect(page).toMatchObject({ width: 800, height: 1100 });
  });

  it('kết quả không có khối nào cho text rỗng và độ tin cậy 0', () => {
    expect(toOcrPageResult({ text: '', blocks: null }, 10, 10)).toEqual({
      text: '',
      confidence: 0,
      width: 10,
      height: 10,
      words: [],
    });
  });
});

describe('buildOcrPageRecords', () => {
  it('sắp theo trang và gắn source ocr cùng kích thước ảnh', () => {
    const records = buildOcrPageRecords(
      new Map([
        [5, result('năm', 50)],
        [2, result('hai', 95)],
      ]),
    );

    expect(records.map((record) => record.page)).toEqual([2, 5]);
    expect(records[0]).toMatchObject({
      source: 'ocr',
      text: 'hai',
      confidence: 95,
      ocr: { width: 1000, height: 1400, words: [] },
    });
  });
});

describe('boxToPageRect', () => {
  const image = { width: 1000, height: 1400 };

  it('quy đổi theo tỉ lệ giữa ảnh OCR và trang đang hiển thị', () => {
    const box = { x0: 100, y0: 200, x1: 300, y1: 240 };
    expect(boxToPageRect(box, image, { width: 500, height: 700 })).toEqual({
      left: 50,
      top: 100,
      width: 100,
      height: 20,
    });
  });

  it('theo kịp zoom: trang to gấp đôi thì hình chữ nhật to gấp đôi', () => {
    const box = { x0: 100, y0: 200, x1: 300, y1: 240 };
    const small = boxToPageRect(box, image, { width: 500, height: 700 });
    const big = boxToPageRect(box, image, { width: 1000, height: 1400 });
    expect(big).toEqual({ left: 100, top: 200, width: 200, height: 40 });
    expect(big?.width).toBe((small?.width ?? 0) * 2);
  });

  it('kẹp hộp vượt ra ngoài ảnh và bỏ hộp rỗng hoặc kích thước hỏng', () => {
    expect(
      boxToPageRect({ x0: -10, y0: 1390, x1: 20, y1: 1500 }, image, { width: 1000, height: 1400 }),
    ).toEqual({ left: 0, top: 1390, width: 20, height: 10 });
    expect(
      boxToPageRect({ x0: 5, y0: 5, x1: 5, y1: 9 }, image, { width: 1000, height: 1400 }),
    ).toBeNull();
    expect(
      boxToPageRect(
        { x0: 1, y0: 1, x1: 9, y1: 9 },
        { width: 0, height: 0 },
        { width: 1, height: 1 },
      ),
    ).toBeNull();
  });
});

describe('runOcr', () => {
  it('nhận dạng tuần tự theo thứ tự trang, báo tiến độ và gọi onPage từng trang', async () => {
    const engine = new FakeEngine(async (call) => result(`trang ${call}`));
    const progress: number[] = [];
    const saved: number[] = [];

    const outcome = await runOcr({
      engine,
      pages: [4, 5, 6],
      renderPage: async () => input,
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p.done),
      onPage: (page) => {
        saved.push(page);
      },
    });

    expect([...outcome.results.keys()]).toEqual([4, 5, 6]);
    expect(outcome.results.get(5)?.text).toBe('trang 2');
    expect(progress).toEqual([1, 2, 3]);
    expect(saved).toEqual([4, 5, 6]);
    expect(outcome.failed).toEqual([]);
  });

  it('một trang lỗi thì đánh dấu và chạy tiếp các trang sau', async () => {
    const engine = new FakeEngine(async (call) => {
      if (call === 2) throw new Error('lỗi');
      return result('ok');
    });

    const outcome = await runOcr({
      engine,
      pages: [1, 2, 3],
      renderPage: async () => input,
      signal: new AbortController().signal,
    });

    expect([...outcome.results.keys()]).toEqual([1, 3]);
    expect(outcome.failed).toEqual([2]);
  });

  it('dừng cả lượt khi lỗi liên tiếp quá ngưỡng', async () => {
    const engine = new FakeEngine(async () => {
      throw new Error('worker hỏng');
    });

    await expect(
      runOcr({
        engine,
        pages: [1, 2, 3, 4, 5, 6],
        renderPage: async () => input,
        signal: new AbortController().signal,
        maxConsecutiveFailures: 3,
      }),
    ).rejects.toThrow('worker hỏng');
    expect(engine.recognized).toHaveLength(3);
  });

  it('huỷ giữa lúc đang nhận dạng thì dừng worker ngay và không xử lý trang sau', async () => {
    const controller = new AbortController();
    const engine = new FakeEngine(() => new Promise<OcrPageResult>(() => undefined));
    const saved: number[] = [];

    const promise = runOcr({
      engine,
      pages: [1, 2, 3],
      renderPage: async () => input,
      signal: controller.signal,
      onPage: (page) => {
        saved.push(page);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(engine.terminated).toBe(1);
    expect(engine.recognized).toEqual([1]);
    expect(saved).toEqual([]);
  });

  it('huỷ giữa các trang giữ lại kết quả đã gửi qua onPage và không nhận dạng thêm', async () => {
    const controller = new AbortController();
    const engine = new FakeEngine(async () => result('ok'));
    const saved: number[] = [];

    await expect(
      runOcr({
        engine,
        pages: [1, 2, 3],
        renderPage: async () => input,
        signal: controller.signal,
        onPage: (page) => {
          saved.push(page);
          if (page === 2) controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(saved).toEqual([1, 2]);
    expect(engine.recognized).toEqual([1, 2]);
  });

  it('đã huỷ từ trước thì không render hay nhận dạng gì', async () => {
    const controller = new AbortController();
    controller.abort();
    const engine = new FakeEngine(async () => result('ok'));
    let rendered = 0;

    await expect(
      runOcr({
        engine,
        pages: [1],
        renderPage: async () => {
          rendered += 1;
          return input;
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(rendered).toBe(0);
    expect(engine.recognized).toEqual([]);
  });
});

describe('withOcrEngine', () => {
  it('luôn dừng worker sau khi xong, kể cả khi tác vụ lỗi', async () => {
    const engine = new FakeEngine(async () => result('ok'));

    await expect(
      withOcrEngine(
        async () => engine,
        async () => {
          throw new Error('hỏng giữa chừng');
        },
      ),
    ).rejects.toThrow('hỏng giữa chừng');
    expect(engine.terminated).toBe(1);

    await withOcrEngine(
      async () => engine,
      async () => 'xong',
    );
    expect(engine.terminated).toBe(2);
  });
});
