// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportAnnotationsJson } from '../../src/core/annotate/exchange';
import { createAnnotation } from '../../src/core/annotate/record';
import type { Annotation, AnnotationColor } from '../../src/core/annotate/types';
import { loadFlashcards } from '../../src/storage/db';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import {
  clearAllAnnotations,
  countAnnotationsForDoc,
  loadAnnotations,
  saveAnnotations,
} from '../../src/storage/db';
import { docIdOf, freshEnvironment, openFile, renderApp, tab, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

const PAGES = ['Xác suất đo mức độ chắc chắn.', 'Attention is scarce before interest.', 'Ba.'];

beforeEach(async () => {
  await freshEnvironment();
});
afterEach(() => {
  cleanup();
  setLocale('vi');
  vi.restoreAllMocks();
});

function textNote(
  id: string,
  docId: string,
  page: number,
  quote: string,
  note = '',
  color: AnnotationColor = 'yellow',
  start = 0,
): Annotation {
  return createAnnotation(
    {
      docId,
      page,
      color,
      note,
      anchor: {
        type: 'text',
        start,
        end: start + quote.length,
        quote,
        prefix: '',
        suffix: '',
        rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.02 }],
      },
    },
    { uuid: () => id, now: () => page * 100 },
  );
}

describe.each(CATALOGS)('tab Ghi chú ($code)', ({ code, text }) => {
  async function open(seed: (docId: string) => Annotation[] = () => []) {
    Object.defineProperty(navigator, 'language', {
      value: code === 'en' ? 'en-US' : 'vi-VN',
      configurable: true,
    });
    const file = registerPdf('sach.pdf', PAGES, []);
    const docId = await docIdOf('sach.pdf');
    await saveAnnotations(seed(docId));
    const view = renderApp();
    await openFile(view.container, file);
    await waitFor(() => expect(document.documentElement.lang).toBe(code));
    await waitForReady();
    await tick(40);
    fireEvent.click(tab(text.notesTab));
    return docId;
  }

  it('chưa có gì thì hướng dẫn cách tạo ghi chú', async () => {
    await open();
    expect(await screen.findByText(text.notesEmpty)).toBeTruthy();
    expect(screen.getByText(text.notesDataHint)).toBeTruthy();
  });

  it('liệt kê theo trang kèm trích đoạn và ghi chú; lọc màu; tìm có dấu và không dấu', async () => {
    await open((d) => [
      textNote('a', d, 1, 'Xác suất đo mức độ chắc chắn', 'Công thức quan trọng', 'green'),
      textNote('b', d, 2, 'Attention is scarce', '', 'yellow'),
    ]);
    expect(await screen.findByRole('heading', { name: text.notesPage(1) })).toBeTruthy();
    expect(screen.getByRole('heading', { name: text.notesPage(2) })).toBeTruthy();
    expect(screen.getByText('Công thức quan trọng')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(text.notesCount(2));

    fireEvent.change(screen.getByRole('combobox', { name: text.notesFilterColor }), {
      target: { value: 'green' },
    });
    expect(screen.getByRole('status').textContent).toBe(text.notesCount(1));
    expect(screen.queryByText('Attention is scarce')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: text.notesFilterColor }), {
      target: { value: 'all' },
    });
    const search = screen.getByRole('searchbox', { name: text.notesSearchPlaceholder });
    fireEvent.input(search, { target: { value: 'xac suat' } });
    expect(screen.getByRole('status').textContent).toBe(text.notesCount(1));
    fireEvent.input(search, { target: { value: 'không có' } });
    expect(screen.getByText(text.notesNoMatch)).toBeTruthy();
  });

  it('bấm vào một mục thì nhảy tới trang đó', async () => {
    await open((d) => [textNote('b', d, 2, 'Attention is scarce')]);
    fireEvent.click(await screen.findByRole('button', { name: /Attention is scarce/ }));
    await waitFor(() => expect(screen.getByText(text.pageLabel(2, 3))).toBeTruthy());
  });

  it('highlight không còn tìm thấy trong văn bản trang nằm ở khu "mồ côi" và có nút Gắn lại', async () => {
    await open((d) => [
      textNote('ok', d, 1, 'Xác suất đo mức độ chắc chắn'),
      textNote('lost', d, 2, 'đoạn đã bị đổi mất rồi'),
    ]);
    const orphans = await screen.findByRole('region', { name: text.notesOrphanTitle });
    expect(within(orphans).getByText('đoạn đã bị đổi mất rồi')).toBeTruthy();
    expect(within(orphans).getByRole('button', { name: text.notesReattach })).toBeTruthy();
    expect(screen.queryByRole('region', { name: text.notesPage(2) })).toBeNull();
    expect(screen.getByRole('region', { name: text.notesPage(1) })).toBeTruthy();
  });

  it('xoá từ danh sách phải hỏi lại; Giữ lại thì không mất gì', async () => {
    const docId = await open((d) => [textNote('a', d, 1, 'Xác suất đo mức độ chắc chắn')]);
    fireEvent.click(await screen.findByRole('button', { name: text.annotDelete }));
    const dialog = await screen.findByRole('dialog', { name: text.annotDeleteTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: text.annotDeleteCancel }));
    expect(await countAnnotationsForDoc(docId)).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: text.annotDelete }));
    const again = await screen.findByRole('dialog', { name: text.annotDeleteTitle });
    fireEvent.click(within(again).getByRole('button', { name: text.annotDeleteConfirm }));
    await waitFor(async () => expect(await countAnnotationsForDoc(docId)).toBe(0));
  });

  it('tạo thẻ ôn tập từ highlight có ghi chú; lần hai báo đã có thẻ giống hệt', async () => {
    const docId = await open((d) => [
      textNote('a', d, 1, 'Xác suất đo mức độ chắc chắn', 'Xác suất là gì?'),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: text.notesFlashcard }));
    expect(await screen.findByText(text.notesFlashcardDone)).toBeTruthy();
    const cards = await loadFlashcards(docId);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      front: 'Xác suất là gì?',
      back: 'Xác suất đo mức độ chắc chắn',
      source: 'note',
      page: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: text.notesFlashcard }));
    expect(await screen.findByText(text.notesFlashcardExists)).toBeTruthy();
    expect(await loadFlashcards(docId)).toHaveLength(1);
  });

  it('câu tiếng Việt không có ghi chú: nhắc thêm ghi chú, không tạo thẻ rỗng', async () => {
    const docId = await open((d) => [textNote('a', d, 1, 'Xác suất đo mức độ chắc chắn')]);
    fireEvent.click(await screen.findByRole('button', { name: text.notesFlashcard }));
    expect(await screen.findByText(text.notesFlashcardNeedNote)).toBeTruthy();
    expect(await loadFlashcards(docId)).toEqual([]);
  });

  it('xuất JSON tải file, nhập lại file hỏng thì báo lỗi và không ghi gì', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const docId = await open((d) => [textNote('a', d, 1, 'Xác suất đo mức độ chắc chắn', 'n')]);
    fireEvent.click(await screen.findByRole('button', { name: text.notesExportJson }));
    expect(created).toHaveLength(1);
    const json = await created[0]!.text();
    expect(json).toContain('"readfocus-annotations"');

    const input = screen.getByLabelText(text.notesImportJson, { selector: 'input' });
    const bad = new File(['{"schema":"khac"}'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [bad], configurable: true });
    fireEvent.change(input);
    expect(await screen.findByText(text.notesImportErrors['wrong-schema'])).toBeTruthy();
    expect(await countAnnotationsForDoc(docId)).toBe(1);
  });

  it('nhập file hợp lệ gộp theo id, giữ bản mới hơn và báo số lượng', async () => {
    const docId = await open((d) => [textNote('a', d, 1, 'Xác suất đo mức độ chắc chắn', 'cũ')]);
    const newer = {
      ...textNote('a', docId, 1, 'Xác suất đo mức độ chắc chắn', 'mới hơn'),
      updatedAt: 99999,
    };
    const extra = textNote('b', docId, 2, 'Attention is scarce');
    const file = new File(
      [exportAnnotationsJson({ id: docId, name: 'sach.pdf', pageCount: 3 }, [newer, extra])],
      'ghi-chu.json',
      { type: 'application/json' },
    );
    const input = screen.getByLabelText(text.notesImportJson, { selector: 'input' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    expect(await screen.findByText(text.notesImportDone(1, 1))).toBeTruthy();
    const saved = await loadAnnotations(docId);
    expect(saved.map((a) => [a.id, a.note])).toEqual([
      ['a', 'mới hơn'],
      ['b', ''],
    ]);
  });
});

/** happy-dom không có window.confirm: gắn một hàm giả để theo dõi các câu hỏi xác nhận. */
function stubConfirm() {
  const fn = vi.fn<(message: string) => boolean>(() => true);
  Object.defineProperty(window, 'confirm', { value: fn, configurable: true, writable: true });
  return fn;
}

describe('xoá dữ liệu và ghi chú', () => {
  async function openWith(count: number) {
    const file = registerPdf('sach.pdf', PAGES, []);
    const docId = await docIdOf('sach.pdf');
    await saveAnnotations(
      Array.from({ length: count }, (_, i) =>
        textNote(`n${i}`, docId, 1, 'Xác suất', '', 'yellow', i),
      ),
    );
    const view = renderApp();
    await openFile(view.container, file);
    await waitForReady();
    await tick(40);
    fireEvent.click(tab(viText.settingsTab));
    return docId;
  }

  it('xoá dữ liệu tài liệu: hộp xác nhận nói rõ ghi chú sẽ bị xoá kèm số lượng', async () => {
    const confirm = stubConfirm().mockReturnValue(false);
    await openWith(3);
    fireEvent.click(await screen.findByRole('button', { name: viText.deleteDocument('sach.pdf') }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    const message = confirm.mock.calls[0]?.[0] as string;
    expect(message).toContain(viText.deleteDocumentNotes(3));
    expect(message).toContain('3 ghi chú');
  });

  it('tài liệu không có ghi chú thì câu xác nhận không nhắc tới ghi chú', async () => {
    const confirm = stubConfirm().mockReturnValue(false);
    await openWith(0);
    fireEvent.click(await screen.findByRole('button', { name: viText.deleteDocument('sach.pdf') }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0]?.[0]).toBe(viText.deleteDocumentConfirm('sach.pdf'));
  });

  it('đồng ý xoá dữ liệu tài liệu thì ghi chú của nó bị xoá', async () => {
    stubConfirm().mockReturnValue(true);
    const docId = await openWith(2);
    fireEvent.click(await screen.findByRole('button', { name: viText.deleteDocument('sach.pdf') }));
    await waitFor(async () => expect(await countAnnotationsForDoc(docId)).toBe(0));
  });

  it('"xoá toàn bộ dữ liệu đọc" mặc định GIỮ ghi chú và nói rõ điều đó', async () => {
    const confirm = stubConfirm().mockReturnValue(true);
    const docId = await openWith(2);
    const option = screen.getByRole('checkbox', { name: viText.deleteAllNotesOption });
    expect((option as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: viText.deleteAll }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm.mock.calls[0]?.[0]).toBe(viText.deleteAllConfirm);
    expect(viText.deleteAllConfirm).toContain('ghi chú');
    await tick(60);
    expect(await countAnnotationsForDoc(docId)).toBe(2);
  });

  it('bật "xoá cả ghi chú": phải xác nhận lần hai; từ chối lần hai thì không xoá gì', async () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const docId = await openWith(2);
    fireEvent.click(screen.getByRole('checkbox', { name: viText.deleteAllNotesOption }));
    fireEvent.click(screen.getByRole('button', { name: viText.deleteAll }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(confirm.mock.calls[1]?.[0]).toBe(viText.deleteAllNotesConfirm(2));
    await tick(60);
    expect(await countAnnotationsForDoc(docId)).toBe(2);
  });

  it('xác nhận cả hai lần thì xoá cả ghi chú', async () => {
    stubConfirm().mockReturnValue(true);
    const docId = await openWith(2);
    fireEvent.click(screen.getByRole('checkbox', { name: viText.deleteAllNotesOption }));
    fireEvent.click(screen.getByRole('button', { name: viText.deleteAll }));
    await waitFor(async () => expect(await countAnnotationsForDoc(docId)).toBe(0));
    await clearAllAnnotations();
  });
});
