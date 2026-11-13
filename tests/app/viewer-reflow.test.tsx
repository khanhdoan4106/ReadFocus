// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnnotation } from '../../src/core/annotate/record';
import type { Annotation } from '../../src/core/annotate/types';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { loadAnnotations, saveAnnotations } from '../../src/storage/db';
import { docIdOf, freshEnvironment, openFile, renderApp, tab, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

const QUOTE = 'Xác suất đo mức độ';
const PAGE1 = `Lời mở đầu rất dài. ${QUOTE} chắc chắn.`;
const STALE_RECT = { x: 0.01, y: 0.01, w: 0.05, h: 0.01 };

beforeEach(async () => {
  await freshEnvironment();
});
afterEach(() => {
  cleanup();
  setLocale('vi');
});

function textNote(id: string, docId: string, start: number, quote = QUOTE): Annotation {
  return createAnnotation(
    {
      docId,
      page: 1,
      note: 'ghi chú giữ nguyên',
      anchor: {
        type: 'text',
        start,
        end: start + quote.length,
        quote,
        prefix: 'mở đầu rất dài. ',
        suffix: ' chắc chắn.',
        rects: [STALE_RECT],
      },
    },
    { uuid: () => id, now: () => 100 },
  );
}

describe.each(CATALOGS)('tính lại vị trí highlight đã moved ($code)', ({ code, text }) => {
  async function open(seed: (docId: string) => Annotation[]) {
    Object.defineProperty(navigator, 'language', {
      value: code === 'en' ? 'en-US' : 'vi-VN',
      configurable: true,
    });
    const file = registerPdf('sach.pdf', [PAGE1, 'Trang hai.'], []);
    const docId = await docIdOf('sach.pdf');
    await saveAnnotations(seed(docId));
    const view = renderApp();
    await openFile(view.container, file);
    await waitFor(() => expect(document.documentElement.lang).toBe(code));
    await waitForReady();
    await tick(60);
    return docId;
  }
  const drawn = () => screen.getByTestId('drawn-annotations').textContent;

  it('highlight đúng chỗ cũ (ok) được vẽ ngay, không có nhãn', async () => {
    await open((d) => [textNote('ok', d, PAGE1.indexOf(QUOTE))]);
    await waitFor(() => expect(drawn()).toBe('ok'));
    fireEvent.click(tab(text.notesTab));
    expect(screen.queryByText(text.notesRelocating)).toBeNull();
    expect(screen.queryByTestId('reflow-ok')).toBeNull();
  });

  it('moved: KHÔNG vẽ rect cũ, chờ tính lại và báo "Đang cập nhật vị trí" trong tab Ghi chú', async () => {
    await open((d) => [textNote('mv', d, 0)]); // offset cũ sai, quote vẫn có trong trang
    const pending = await screen.findByTestId('reflow-mv');
    expect(pending.textContent).toBe(
      `reflow mv ${PAGE1.indexOf(QUOTE)}-${PAGE1.indexOf(QUOTE) + QUOTE.length}`,
    );
    expect(drawn()).toBe('');

    fireEvent.click(tab(text.notesTab));
    const entry = (await screen.findByText(QUOTE)).closest('li') as HTMLElement;
    expect(within(entry).getByText(text.notesRelocating)).toBeTruthy();
  });

  it('khi text layer tính xong: lưu đè start/end/rect, giữ quote/prefix/suffix/ghi chú, tăng updatedAt, rồi mới vẽ', async () => {
    const docId = await open((d) => [textNote('mv', d, 0)]);
    fireEvent.click(await screen.findByTestId('reflow-mv'));

    await waitFor(async () => {
      const [saved] = await loadAnnotations(docId);
      expect(saved?.anchor).toMatchObject({
        type: 'text',
        start: PAGE1.indexOf(QUOTE),
        end: PAGE1.indexOf(QUOTE) + QUOTE.length,
        quote: QUOTE,
        prefix: 'mở đầu rất dài. ',
        suffix: ' chắc chắn.',
        rects: [{ x: 0.5, y: 0.5, w: 0.1, h: 0.02 }],
      });
      expect(saved?.note).toBe('ghi chú giữ nguyên');
      expect(saved?.createdAt).toBe(100);
      expect(saved?.updatedAt).toBeGreaterThan(100);
    });
    await waitFor(() => expect(drawn()).toBe('mv'));
    expect(screen.queryByTestId('reflow-mv')).toBeNull();
    fireEvent.click(tab(text.notesTab));
    expect(screen.queryByText(text.notesRelocating)).toBeNull();
  });

  it('chưa tính lại được thì không bị ghi đè: bản ghi giữ nguyên rect cũ', async () => {
    const docId = await open((d) => [textNote('mv', d, 0)]);
    await screen.findByTestId('reflow-mv');
    await tick(60);
    const [saved] = await loadAnnotations(docId);
    expect(saved?.anchor).toMatchObject({ start: 0, rects: [STALE_RECT] });
    expect(saved?.updatedAt).toBe(100);
  });

  it('mồ côi: không vẽ, không chờ tính lại, không có nhãn "Đang cập nhật"', async () => {
    await open((d) => [textNote('lost', d, 0, 'đoạn không còn trong trang')]);
    fireEvent.click(tab(text.notesTab));
    expect(await screen.findByRole('region', { name: text.notesOrphanTitle })).toBeTruthy();
    expect(drawn()).toBe('');
    expect(screen.queryByTestId('reflow-lost')).toBeNull();
    expect(screen.queryByText(text.notesRelocating)).toBeNull();
  });
});
