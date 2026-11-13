/** Phần tử đang giữ focus có đáng nhớ để trả focus về không (không phải body). */
export function focusableOpener(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement)) return null;
  if (active === document.body || active === document.documentElement) return null;
  return active;
}

/**
 * Nơi trả focus khi đóng popover của một ghi chú, theo thứ tự:
 * 1. phần tử đã mở popover, nếu còn trong trang;
 * 2. mục tương ứng trong tab Ghi chú, nếu đang hiện;
 * 3. vùng trang (khung `.pdf-page`) của ghi chú.
 */
export function resolveFocusTarget(
  opener: HTMLElement | null,
  noteId: string,
  page: number | null,
  root: ParentNode = document,
): HTMLElement | null {
  if (opener?.isConnected) return opener;
  const entry = root.querySelector<HTMLElement>(
    `[data-note-id="${CSS.escape(noteId)}"] .notes__jump`,
  );
  if (entry) return entry;
  if (page !== null) {
    return root.querySelector<HTMLElement>(`.page-slot[data-page="${page}"] .pdf-page`);
  }
  return null;
}

/** Trả focus sau khi popover đã gỡ khỏi DOM (đợi một nhịp để Preact render xong). */
export function returnFocus(opener: HTMLElement | null, noteId: string, page: number | null): void {
  setTimeout(() => resolveFocusTarget(opener, noteId, page)?.focus(), 0);
}
