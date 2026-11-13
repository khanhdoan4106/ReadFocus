import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { boundingRect, locateSelection } from '../../core/annotate/locate';
import type { Anchor, Annotation, AnnotationColor, Rect } from '../../core/annotate/types';
import type { TextPage } from '../../core/summarize/chunk';
import { t } from '../../i18n';
import { focusableOpener, returnFocus } from '../focus-return';
import { readPageSelection, type PageSelection } from '../selection';
import type { AnnotationsApi } from './useAnnotations';

type Input = {
  api: AnnotationsApi;
  pages: readonly TextPage[];
  /** Trang đang đọc, dùng cho phím N (ghi chú trang). */
  getCurrentPage: () => number;
  ready: boolean;
  showToast: (message: string) => void;
};

export type PopoverState = { id: string; x: number; y: number; focusNote: boolean };

/**
 * Trạng thái giao diện ghi chú: thanh nổi khi chọn chữ, chế độ vùng, popover sửa, hộp xóa.
 * Mọi thay đổi dữ liệu đi qua `api`; xóa chỉ chạy sau `confirmDelete`.
 */
export function useAnnotationUi({ api, pages, getCurrentPage, ready, showToast }: Input) {
  const [areaMode, setAreaMode] = useState(false);
  const [bar, setBar] = useState<PageSelection | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  // Phần tử giữ focus lúc mở popover, để trả focus về khi đóng.
  const openerRef = useRef<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [color, setColor] = useState<AnnotationColor>('yellow');

  // Thanh nổi theo vùng chọn: cập nhật sau khi thả chuột hoặc dùng phím chọn chữ.
  useEffect(() => {
    if (!ready) return;
    const refresh = () => setBar(readPageSelection());
    const later = () => setTimeout(refresh, 0);
    const clearIfCollapsed = () => {
      if (window.getSelection()?.isCollapsed) setBar(null);
    };
    document.addEventListener('mouseup', later);
    document.addEventListener('keyup', later);
    document.addEventListener('selectionchange', clearIfCollapsed);
    return () => {
      document.removeEventListener('mouseup', later);
      document.removeEventListener('keyup', later);
      document.removeEventListener('selectionchange', clearIfCollapsed);
    };
  }, [ready]);

  const openPopover = useCallback((id: string, x: number, y: number, focusNote = false) => {
    openerRef.current = focusableOpener(document.activeElement);
    setPopover({ id, x, y, focusNote });
  }, []);

  /** Đóng popover (Xong, Esc, bấm ra ngoài) và trả focus về nơi đã mở nó. */
  const closePopover = useCallback(() => {
    setPopover((current) => {
      if (current !== null) {
        const page = api.items.find((item) => item.id === current.id)?.page ?? null;
        returnFocus(openerRef.current, current.id, page);
      }
      return null;
    });
  }, [api.items]);

  /** Tạo highlight từ vùng chọn. Không tìm được trong văn bản trang thì đổi sang highlight vùng. */
  const highlightSelection = useCallback(
    (chosen: AnnotationColor, withNote: boolean): void => {
      const selection = readPageSelection();
      if (selection === null) {
        showToast(t.annotNoSelection);
        return;
      }
      const pageText = pages.find((p) => p.page === selection.page)?.text ?? '';
      let anchor: Anchor | null = locateSelection(
        pageText,
        selection.text,
        selection.ratio,
        selection.rects,
      );
      if (anchor === null) {
        const box = boundingRect(selection.rects);
        if (box === null) return;
        anchor = { type: 'area', rect: box };
        showToast(t.annotFallbackArea);
      }
      const created = api.add({ page: selection.page, anchor, color: chosen });
      window.getSelection()?.removeAllRanges();
      setBar(null);
      setColor(chosen);
      if (created && withNote)
        openPopover(created.id, selection.anchor.x, selection.anchor.y, true);
    },
    [api, pages, openPopover, showToast],
  );

  const addAreaNote = useCallback(
    (page: number, rect: Rect, x: number, y: number) => {
      if (rect.w < 0.01 || rect.h < 0.01) return;
      const created = api.add({ page, anchor: { type: 'area', rect }, color });
      if (created) openPopover(created.id, x, y, true);
    },
    [api, color, openPopover],
  );

  /** Gắn lại một highlight mồ côi vào đoạn chữ đang chọn (cùng trang). */
  const reattach = useCallback(
    (annotation: Annotation) => {
      const selection = readPageSelection();
      if (selection === null || selection.page !== annotation.page) {
        showToast(t.annotNoSelection);
        return;
      }
      const pageText = pages.find((p) => p.page === selection.page)?.text ?? '';
      const anchor = locateSelection(pageText, selection.text, selection.ratio, selection.rects);
      if (anchor === null) {
        showToast(t.annotFallbackArea);
        return;
      }
      api.change(annotation.id, { anchor });
      window.getSelection()?.removeAllRanges();
      showToast(t.notesReattachDone);
    },
    [api, pages, showToast],
  );

  /** Phím N: ghi chú gắn với cả trang đang đọc. */
  const addPageNote = useCallback(() => {
    const created = api.add({ page: getCurrentPage(), anchor: { type: 'page' }, color });
    if (created) {
      openPopover(created.id, Math.round(window.innerWidth / 2) - 150, 120, true);
    }
  }, [api, color, getCurrentPage, openPopover]);

  return {
    areaMode,
    toggleAreaMode: () => setAreaMode((on) => !on),
    bar,
    popover,
    closePopover,
    openPopover,
    deleting,
    askDelete: (id: string) => setDeleting(id),
    cancelDelete: () => setDeleting(null),
    confirmDelete: async () => {
      if (deleting === null) return;
      const id = deleting;
      // Nhớ trang trước khi xoá: sau khi xoá, mục không còn trong danh sách.
      const page = api.items.find((item) => item.id === id)?.page ?? null;
      setDeleting(null);
      if (await api.remove(id)) {
        setPopover((current) => {
          if (current?.id !== id) return current;
          returnFocus(openerRef.current, id, page);
          return null;
        });
      }
    },
    color,
    highlightSelection,
    addAreaNote,
    addPageNote,
    reattach,
  };
}

export type AnnotationUi = ReturnType<typeof useAnnotationUi>;
