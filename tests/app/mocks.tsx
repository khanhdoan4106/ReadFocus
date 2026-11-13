/**
 * Đồ giả dùng chung cho test component của viewer: PDF giả, `chrome.*` giả,
 * provider AI giả (có đếm request) và engine OCR giả.
 */
import { vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { LLMProvider, LLMRequest } from '../../src/core/llm/types';
import type { OcrEngine, OcrInput, OcrPageResult } from '../../src/core/ocr/types';

// ---------------------------------------------------------------------------
// PDF giả. Nội dung file là tên file; `openPdfData` tra tên đó trong `pdfs`.
// ---------------------------------------------------------------------------

export type FakeOutline = { title: string; page: number };

export type FakePdf = PDFDocumentProxy & { destroyed: boolean };

export const pdfs = new Map<string, FakePdf>();

export function makePdf(pages: readonly string[], outline: readonly FakeOutline[] = []): FakePdf {
  const doc = {
    numPages: pages.length,
    destroyed: false,
    async getPage(number: number) {
      const text = pages[number - 1] ?? '';
      return {
        getViewport: ({ scale }: { scale: number }) => ({
          width: 612 * scale,
          height: 792 * scale,
        }),
        async getTextContent() {
          return {
            items:
              text === ''
                ? []
                : [{ str: text, transform: [12, 0, 0, 12, 50, 700], width: 300, height: 12 }],
            styles: {},
          };
        },
      } as unknown as PDFPageProxy;
    },
    async getOutline() {
      return outline.length === 0
        ? null
        : outline.map((entry) => ({ title: entry.title, dest: [entry.page - 1], items: [] }));
    },
    async getDestination() {
      return null;
    },
    async getPageIndex() {
      return 0;
    },
  } as unknown as FakePdf;
  return doc;
}

/** Đăng ký một PDF giả và trả `File` có cùng tên để đưa vào viewer. */
export function registerPdf(
  name: string,
  pages: readonly string[],
  outline: readonly FakeOutline[] = [],
): File {
  pdfs.set(name, makePdf(pages, outline));
  return new File([name], name, { type: 'application/pdf' });
}

export function pdfModule() {
  return {
    MAX_FILE_BYTES: 200 * 1024 * 1024,
    isPdfFile: () => true,
    readPdfFile: async (file: File) => ({
      ok: true as const,
      data: new TextEncoder().encode(file.name).buffer as ArrayBuffer,
    }),
    openPdfData: async (data: ArrayBuffer) => {
      const name = new TextDecoder().decode(data);
      const doc = pdfs.get(name);
      if (!doc) return { ok: false as const, reason: 'invalid' as const };
      return {
        ok: true as const,
        data,
        doc,
        close: async () => {
          doc.destroyed = true;
        },
      };
    },
  };
}

/** Thay `PageList` thật (cần IntersectionObserver, canvas): chỉ dựng khung trang. */
export function fakePageListModule() {
  return {
    PageList(props: {
      doc: PDFDocumentProxy;
      highlight: { page: number; query: string } | null;
      onCurrentPageChange: (page: number) => void;
    }) {
      return (
        <div data-testid="page-list">
          {Array.from({ length: props.doc.numPages }, (_, index) => (
            <div class="page-slot" data-page={index + 1} key={index}>
              {`Trang ${index + 1}`}
            </div>
          ))}
          {props.highlight && (
            <div data-testid="highlight">{`${props.highlight.page}:${props.highlight.query}`}</div>
          )}
          <button
            type="button"
            data-testid="scroll-to-3"
            onClick={() => props.onCurrentPageChange(3)}
          >
            giả lập cuộn tới trang 3
          </button>
        </div>
      );
    },
  };
}

// ---------------------------------------------------------------------------
// chrome.* giả
// ---------------------------------------------------------------------------

type FakeArea = {
  data: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function makeArea(): FakeArea {
  const area: FakeArea = {
    data: {},
    get: vi.fn(async (keys?: string | string[]) => {
      if (keys === undefined) return { ...area.data };
      const list = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(
        list.filter((key) => key in area.data).map((k) => [k, area.data[k]]),
      );
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(area.data, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete area.data[key];
    }),
  };
  return area;
}

export type FakeChrome = {
  local: FakeArea;
  session: FakeArea;
  sync: FakeArea;
  permissionsRequest: ReturnType<typeof vi.fn>;
};

export function installChrome(): FakeChrome {
  const local = makeArea();
  const session = makeArea();
  const sync = makeArea();
  const permissionsRequest = vi.fn(async () => true);
  Object.assign(globalThis, {
    chrome: {
      storage: { local, session, sync },
      permissions: {
        request: permissionsRequest,
        contains: vi.fn(async () => false),
        remove: vi.fn(async () => true),
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        sendMessage: vi.fn(async () => undefined),
      },
      notifications: { create: vi.fn() },
    },
  });
  return { local, session, sync, permissionsRequest };
}

// ---------------------------------------------------------------------------
// Provider AI giả: mỗi lời gọi là một request được ghi lại và chờ `resolve`.
// ---------------------------------------------------------------------------

export type PendingCall = {
  request: LLMRequest;
  signal: AbortSignal | undefined;
  resolve: (text: string) => void;
};

export const aiCalls: PendingCall[] = [];

export const fakeProvider: LLMProvider = {
  id: 'openai',
  label: 'OpenAI',
  defaultModel: 'gpt-4o-mini',
  defaultBaseUrl: 'https://api.openai.com/v1',
  complete(request, _config, options) {
    return new Promise<string>((resolve) => {
      aiCalls.push({ request, signal: options?.signal, resolve });
    });
  },
  async checkConnection() {},
};

export function summaryJson(text: string): string {
  return JSON.stringify({
    summary: text,
    keyPoints: [{ text: `Ý chính của ${text}`, pages: [1] }],
    terms: [{ term: 'xác suất', definition: 'Mức độ chắc chắn của một sự kiện.' }],
  });
}

// ---------------------------------------------------------------------------
// Engine OCR giả: mỗi lần nhận dạng chờ test cho phép.
// ---------------------------------------------------------------------------

export type PendingOcr = { input: OcrInput; resolve: (result: OcrPageResult) => void };

export const ocrState = {
  pending: [] as PendingOcr[],
  created: 0,
  terminated: 0,
};

export function fakeOcrEngineModule() {
  return {
    createTesseractEngine: async (): Promise<OcrEngine> => {
      ocrState.created += 1;
      return {
        recognize: (input) =>
          new Promise<OcrPageResult>((resolve) => {
            ocrState.pending.push({ input, resolve });
          }),
        terminate: async () => {
          ocrState.terminated += 1;
        },
      };
    },
  };
}

export function resetMocks(): void {
  pdfs.clear();
  aiCalls.length = 0;
  ocrState.pending.length = 0;
  ocrState.created = 0;
  ocrState.terminated = 0;
}
