import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEffect } from 'preact/hooks';

import type { RefObject } from 'preact';

type Input = {
  /** Có tài liệu đang mở và đọc được. */
  ready: boolean;
  docRef: RefObject<PDFDocumentProxy | null>;
  pageNumberRef: RefObject<number>;
  focusMode: boolean;
  goToPage: (page: number) => void;
  toggleFocusMode: () => void;
  toggleTimer: () => void;
  moveBand: (delta: number) => void;
  /** Mở thanh bên và đưa focus vào ô tìm kiếm. */
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  /** Phím H: highlight vùng chữ đang chọn. */
  onHighlight: () => void;
  /** Phím N: ghi chú cho trang đang đọc. */
  onPageNote: () => void;
};

/**
 * Phím tắt của viewer. Không chạy khi đang gõ trong ô nhập, khi có hộp thoại phương thức
 * đang mở hoặc khi giữ Alt/Ctrl/Meta.
 */
export function useShortcuts({
  ready,
  docRef,
  pageNumberRef,
  focusMode,
  goToPage,
  toggleFocusMode,
  toggleTimer,
  moveBand,
  onOpenSearch,
  onToggleSidebar,
  onHighlight,
  onPageNote,
}: Input) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (docRef.current === null || !ready) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      // Đang ở hàng tab: ←/→/Home/End thuộc về tablist (xem Sidebar), không chuyển trang.
      if (
        target?.closest('[role="tablist"]') &&
        ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
      ) {
        return;
      }
      // Hộp thoại đang mở: phím tắt của viewer không được chạy phía sau nó.
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (focusMode) {
        if (event.key === 'Escape') {
          event.preventDefault();
          toggleFocusMode();
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const delta = event.key === 'ArrowUp' ? -32 : 32;
          moveBand(delta);
          return;
        }
      }

      if (event.key === '/') {
        event.preventDefault();
        if (focusMode) toggleFocusMode();
        onOpenSearch();
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFocusMode();
      } else if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        onHighlight();
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        onPageNote();
      } else if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        onToggleSidebar();
      } else if (event.key === ' ') {
        // Để nút đang có focus tự xử lý Space, tránh vừa bấm nút vừa đổi hẹn giờ.
        if (target?.tagName === 'BUTTON' || target?.tagName === 'A') return;
        event.preventDefault();
        toggleTimer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToPage(pageNumberRef.current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPage(pageNumberRef.current - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    docRef,
    focusMode,
    goToPage,
    moveBand,
    onHighlight,
    onOpenSearch,
    onPageNote,
    onToggleSidebar,
    pageNumberRef,
    ready,
    toggleFocusMode,
    toggleTimer,
  ]);
}
