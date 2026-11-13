// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { h } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationLayer, hitTest } from '../../src/viewer/AnnotationLayer';
import { createAnnotation } from '../../src/core/annotate/record';
import type { Annotation } from '../../src/core/annotate/types';
import { en } from '../../src/i18n/en';
import { setLocale, type Messages } from '../../src/i18n';
import { vi as viText } from '../../src/i18n/vi';
import { loadAnnotations } from '../../src/storage/db';
import { docIdOf, freshEnvironment, openFile, renderApp, tick, waitForReady } from './helpers';
import { registerPdf } from './mocks';

vi.mock('../../src/viewer/pdf', async () => (await import('./mocks')).pdfModule());
vi.mock('../../src/viewer/PageList', async () => (await import('./mocks')).fakePageListModule());

const CATALOGS = [
  { code: 'vi', text: viText as Messages },
  { code: 'en', text: en as Messages },
] as const;

beforeEach(async () => {
  await freshEnvironment();
});
afterEach(() => {
  cleanup();
  setLocale('vi');
  vi.restoreAllMocks();
});

const RECT = { x: 0.1, y: 0.2, w: 0.3, h: 0.05 };

function note(partial: Partial<Annotation> & Pick<Annotation, 'kind' | 'anchor'>): Annotation {
  return {
    ...createAnnotation(
      { docId: 'd', page: 1, anchor: partial.anchor },
      { uuid: () => partial.id ?? 'a1', now: () => 1 },
    ),
    ...partial,
  };
}

describe('AnnotationLayer', () => {
  it('vẽ rect theo phần trăm của trang (đúng với mọi zoom), có aria-label', () => {
    const text = note({
      id: 't1',
      kind: 'text',
      color: 'green',
      anchor: {
        type: 'text',
        start: 0,
        end: 4,
        quote: 'Xác suất',
        prefix: '',
        suffix: '',
        rects: [RECT],
      },
    });
    const area = note({
      id: 'r1',
      kind: 'area',
      color: 'pink',
      anchor: { type: 'area', rect: RECT },
    });
    render(
      h(AnnotationLayer, {
        annotations: [text, area],
        areaMode: false,
        onDrawArea: vi.fn(),
        onOpen: vi.fn(),
      }),
    );
    const rects = screen.getAllByRole('img');
    expect(rects).toHaveLength(2);
    expect(rects[0]?.getAttribute('aria-label')).toBe(viText.annotTextAria('Xanh lá', 'Xác suất'));
    expect(rects[1]?.getAttribute('aria-label')).toBe(viText.annotAreaAria('Hồng'));
    const style = (rects[0] as HTMLElement).style;
    expect(style.left).toBe('10%');
    expect(style.top).toBe('20%');
    expect(style.width).toBe('30%');
    expect((rects[0] as HTMLElement).className).toContain('annot-rect--green');
  });

  it('ghi chú trang là nút thật, bấm thì mở', () => {
    const onOpen = vi.fn();
    const pageNote = note({ id: 'p1', kind: 'page', anchor: { type: 'page' }, note: 'Đọc lại' });
    render(
      h(AnnotationLayer, { annotations: [pageNote], areaMode: false, onDrawArea: vi.fn(), onOpen }),
    );
    fireEvent.click(screen.getByRole('button', { name: viText.annotPageNoteAria('Đọc lại') }));
    expect(onOpen).toHaveBeenCalledWith('p1', expect.any(Number), expect.any(Number));
  });

  it('chế độ vùng: kéo chuột trả về rect chuẩn hóa; vùng quá nhỏ vẫn được báo để nơi gọi bỏ qua', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 200,
      right: 500,
      bottom: 250,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    const onDrawArea = vi.fn();
    render(h(AnnotationLayer, { annotations: [], areaMode: true, onDrawArea, onOpen: vi.fn() }));
    const draw = screen.getByRole('application', { name: viText.annotAreaLayer });
    fireEvent.pointerDown(draw, { clientX: 140, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(draw, { clientX: 300, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(draw, { clientX: 300, clientY: 150, pointerId: 1 });
    expect(onDrawArea).toHaveBeenCalledTimes(1);
    const [rect] = onDrawArea.mock.calls[0] as [{ x: number; y: number; w: number; h: number }];
    expect(rect.x).toBeCloseTo(0.1);
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.w).toBeCloseTo(0.4);
    expect(rect.h).toBeCloseTo(0.4);
  });

  it('không ở chế độ vùng thì không có lớp kéo (không chặn bôi đen chữ)', () => {
    render(
      h(AnnotationLayer, {
        annotations: [],
        areaMode: false,
        onDrawArea: vi.fn(),
        onOpen: vi.fn(),
      }),
    );
    expect(screen.queryByRole('application')).toBeNull();
  });
});

describe('hitTest', () => {
  it('chọn highlight chứa điểm, cái tạo sau nằm trên', () => {
    const a = note({ id: 'a', kind: 'area', anchor: { type: 'area', rect: RECT } });
    const b = note({ id: 'b', kind: 'area', anchor: { type: 'area', rect: RECT } });
    expect(hitTest([a, b], { x: 0.2, y: 0.22 })?.id).toBe('b');
    expect(hitTest([a, b], { x: 0.9, y: 0.9 })).toBeNull();
    expect(
      hitTest([note({ kind: 'page', anchor: { type: 'page' } })], { x: 0.1, y: 0.1 }),
    ).toBeNull();
  });
});

describe.each(CATALOGS)('ghi chú trong viewer ($code)', ({ code, text }) => {
  async function open() {
    Object.defineProperty(navigator, 'language', {
      value: code === 'en' ? 'en-US' : 'vi-VN',
      configurable: true,
    });
    const view = renderApp();
    await openFile(view.container, registerPdf('sach.pdf', ['Một.', 'Hai.', 'Ba.'], []));
    await waitFor(() => expect(document.documentElement.lang).toBe(code));
    await waitForReady();
    await tick(30);
  }

  it('nút Đánh dấu vùng bật/tắt và có aria-pressed', async () => {
    await open();
    const button = screen.getByRole('button', { name: text.annotAreaMode });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('H khi chưa chọn chữ: báo cần bôi đen, không tạo gì', async () => {
    await open();
    fireEvent.keyDown(document.body, { key: 'h' });
    expect(await screen.findByText(text.annotNoSelection)).toBeTruthy();
    expect(await loadAnnotations(await docIdOf('sach.pdf'))).toEqual([]);
  });

  it('N tạo ghi chú trang, hộp sửa mở sẵn ô ghi chú; Esc lưu và đóng', async () => {
    await open();
    fireEvent.keyDown(document.body, { key: 'n' });
    const dialog = await screen.findByRole('dialog', { name: text.annotPopoverLabel });
    const box = within(dialog).getByLabelText(text.annotNoteLabel) as HTMLTextAreaElement;
    await waitFor(() => expect(document.activeElement).toBe(box));

    fireEvent.input(box, { target: { value: 'Đọc lại trang này' } });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: text.annotPopoverLabel })).toBeNull(),
    );

    const saved = await loadAnnotations(await docIdOf('sach.pdf'));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: 'page', page: 1, note: 'Đọc lại trang này' });
  });

  it('phím H/N không chạy khi đang gõ trong ô ghi chú', async () => {
    await open();
    fireEvent.keyDown(document.body, { key: 'n' });
    const dialog = await screen.findByRole('dialog', { name: text.annotPopoverLabel });
    const box = within(dialog).getByLabelText(text.annotNoteLabel);
    fireEvent.keyDown(box, { key: 'n' });
    fireEvent.keyDown(box, { key: 'h' });
    await tick(20);
    expect(await loadAnnotations(await docIdOf('sach.pdf'))).toHaveLength(1);
  });

  it('đổi màu trong hộp sửa được lưu; xoá phải hỏi lại và Giữ lại thì không mất', async () => {
    await open();
    fireEvent.keyDown(document.body, { key: 'n' });
    const dialog = await screen.findByRole('dialog', { name: text.annotPopoverLabel });
    fireEvent.click(within(dialog).getByRole('radio', { name: text.annotColors.blue }));
    await waitFor(async () =>
      expect((await loadAnnotations(await docIdOf('sach.pdf')))[0]?.color).toBe('blue'),
    );

    fireEvent.click(within(dialog).getByRole('button', { name: text.annotDelete }));
    const confirm = await screen.findByRole('dialog', { name: text.annotDeleteTitle });
    expect(confirm.textContent).toContain(text.annotDeleteBody);
    fireEvent.click(within(confirm).getByRole('button', { name: text.annotDeleteCancel }));
    expect(await loadAnnotations(await docIdOf('sach.pdf'))).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole('button', { name: text.annotDelete }));
    const again = await screen.findByRole('dialog', { name: text.annotDeleteTitle });
    fireEvent.click(within(again).getByRole('button', { name: text.annotDeleteConfirm }));
    await waitFor(async () => expect(await loadAnnotations(await docIdOf('sach.pdf'))).toEqual([]));
  });
});
