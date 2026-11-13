// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnnotation } from '../../src/core/annotate/record';
import type { Annotation } from '../../src/core/annotate/types';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { countAnnotationsForDoc, saveAnnotations } from '../../src/storage/db';
import { resolveFocusTarget } from '../../src/viewer/focus-return';
import { docIdOf, freshEnvironment, openFile, renderApp, tab, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

const QUOTE = 'Xác suất đo mức độ';
const PAGES = [`${QUOTE} chắc chắn.`, 'Trang hai.'];

beforeEach(async () => {
  await freshEnvironment();
});
afterEach(() => {
  cleanup();
  setLocale('vi');
  document.body.innerHTML = '';
});

function note(docId: string): Annotation {
  return createAnnotation(
    {
      docId,
      page: 1,
      note: 'ghi chú',
      anchor: {
        type: 'text',
        start: 0,
        end: QUOTE.length,
        quote: QUOTE,
        prefix: '',
        suffix: ' chắc chắn.',
        rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.02 }],
      },
    },
    { uuid: () => 'n1', now: () => 100 },
  );
}

describe.each(CATALOGS)('trả focus khi đóng popover ($code)', ({ code, text }) => {
  async function open(withNote = true) {
    Object.defineProperty(navigator, 'language', {
      value: code === 'en' ? 'en-US' : 'vi-VN',
      configurable: true,
    });
    const file = registerPdf('sach.pdf', PAGES, []);
    const docId = await docIdOf('sach.pdf');
    if (withNote) await saveAnnotations([note(docId)]);
    const view = renderApp();
    await openFile(view.container, file);
    await waitFor(() => expect(document.documentElement.lang).toBe(code));
    await waitForReady();
    await tick(40);
    return docId;
  }

  /** Mở popover từ nút "Sửa" của tab Ghi chú (nút đang giữ focus như khi bấm bằng chuột/bàn phím). */
  async function openFromNotes() {
    fireEvent.click(tab(text.notesTab));
    const editButton = await screen.findByRole('button', { name: text.notesEdit });
    editButton.focus();
    fireEvent.click(editButton);
    const dialog = await screen.findByRole('dialog', { name: text.annotPopoverLabel });
    return { editButton, dialog };
  }
  const closed = () =>
    waitFor(() =>
      expect(screen.queryByRole('dialog', { name: text.annotPopoverLabel })).toBeNull(),
    );

  it('Xong: focus về nút Sửa đã mở popover', async () => {
    await open();
    const { editButton, dialog } = await openFromNotes();
    fireEvent.click(within(dialog).getByRole('button', { name: text.annotDone }));
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(editButton));
  });

  it('Esc: focus về nút Sửa', async () => {
    await open();
    const { editButton, dialog } = await openFromNotes();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(editButton));
  });

  it('bấm ra ngoài: lưu ghi chú, đóng và trả focus về nút Sửa', async () => {
    const docId = await open();
    const { editButton, dialog } = await openFromNotes();
    fireEvent.input(within(dialog).getByLabelText(text.annotNoteLabel), {
      target: { value: 'sửa rồi bấm ra ngoài' },
    });
    fireEvent.pointerDown(document.body);
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(editButton));
    expect(await countAnnotationsForDoc(docId)).toBe(1);
  });

  it('bấm bên trong popover không làm nó đóng', async () => {
    await open();
    const { dialog } = await openFromNotes();
    fireEvent.pointerDown(within(dialog).getByLabelText(text.annotNoteLabel));
    await tick(30);
    expect(screen.queryByRole('dialog', { name: text.annotPopoverLabel })).toBeTruthy();
  });

  it('sau khi xoá: phần tử mở popover không còn nên focus về vùng trang của ghi chú', async () => {
    const docId = await open();
    const { editButton, dialog } = await openFromNotes();
    fireEvent.click(within(dialog).getByRole('button', { name: text.annotDelete }));
    const confirm = await screen.findByRole('dialog', { name: text.annotDeleteTitle });
    // Bấm trong hộp xác nhận (nằm ngoài popover) không được đóng popover.
    fireEvent.pointerDown(within(confirm).getByRole('button', { name: text.annotDeleteConfirm }));
    expect(screen.queryByRole('dialog', { name: text.annotPopoverLabel })).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: text.annotDeleteConfirm }));

    await waitFor(async () => expect(await countAnnotationsForDoc(docId)).toBe(0));
    await closed();
    expect(editButton.isConnected).toBe(false);
    const pageArea = document.querySelector('.page-slot[data-page="1"] .pdf-page');
    expect(pageArea).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(pageArea));
  });

  it('mở bằng phím N (không có phần tử mở): đóng thì focus về vùng trang đang đọc', async () => {
    await open(false);
    fireEvent.keyDown(document.body, { key: 'n' });
    const dialog = await screen.findByRole('dialog', { name: text.annotPopoverLabel });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await closed();
    const pageArea = document.querySelector('.page-slot[data-page="1"] .pdf-page');
    await waitFor(() => expect(document.activeElement).toBe(pageArea));
  });
});

describe('resolveFocusTarget', () => {
  function dom() {
    document.body.innerHTML = `
      <div class="page-slot" data-page="2"><div class="pdf-page" tabindex="-1" id="area"></div></div>
      <ul><li data-note-id="n1"><button class="notes__jump" id="entry"></button></li></ul>
      <button id="opener"></button>`;
    return {
      opener: document.getElementById('opener') as HTMLElement,
      entry: document.getElementById('entry') as HTMLElement,
      area: document.getElementById('area') as HTMLElement,
    };
  }

  it('ưu tiên phần tử đã mở nếu còn trong trang', () => {
    const { opener } = dom();
    expect(resolveFocusTarget(opener, 'n1', 2)).toBe(opener);
  });

  it('phần tử đã mở không còn: về mục trong tab Ghi chú', () => {
    const { opener, entry } = dom();
    opener.remove();
    expect(resolveFocusTarget(opener, 'n1', 2)).toBe(entry);
  });

  it('không có mục trong tab Ghi chú: về vùng trang', () => {
    const { opener, entry, area } = dom();
    opener.remove();
    entry.closest('li')?.remove();
    expect(resolveFocusTarget(opener, 'n1', 2)).toBe(area);
  });

  it('không còn gì để trả focus (không biết trang): null', () => {
    const { opener, entry } = dom();
    opener.remove();
    entry.closest('li')?.remove();
    expect(resolveFocusTarget(opener, 'n1', null)).toBeNull();
    expect(resolveFocusTarget(null, 'n1', 9)).toBeNull();
  });
});
