import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { resolveTextAnchor, type AnchorResolution } from '../../core/annotate/anchor';
import {
  createAnnotation,
  updateAnnotation,
  type NewAnnotationInput,
} from '../../core/annotate/record';
import type { Anchor, Annotation, AnnotationColor } from '../../core/annotate/types';
import type { TextPage } from '../../core/summarize/chunk';
import { deleteAnnotation, loadAnnotations, saveAnnotations } from '../../storage/db';

type Input = {
  docId: string | null;
  /** Văn bản đã trích theo trang, dùng để neo lại highlight chữ. */
  pages: readonly TextPage[];
};

export type AnnotationStatus = AnchorResolution['status'];

/**
 * Ghi chú và highlight của tài liệu đang mở. Lưu ngay xuống IndexedDB sau mỗi thay đổi;
 * xóa chỉ xảy ra khi giao diện đã hỏi xác nhận và gọi `remove`.
 */
export function useAnnotations({ docId, pages }: Input) {
  const [items, setItems] = useState<Annotation[]>([]);
  const [failed, setFailed] = useState(false);
  const scopeRef = useRef(0);

  useEffect(() => {
    scopeRef.current += 1;
    const scope = scopeRef.current;
    setItems([]);
    setFailed(false);
    if (docId === null) return;
    void loadAnnotations(docId).then((loaded) => {
      if (scopeRef.current === scope) setItems(loaded);
    });
  }, [docId]);

  const persist = useCallback(async (records: Annotation[]) => {
    const ok = await saveAnnotations(records);
    setFailed(!ok);
  }, []);

  const add = useCallback(
    (input: Omit<NewAnnotationInput, 'docId'>): Annotation | null => {
      if (docId === null) return null;
      const created = createAnnotation({ ...input, docId });
      setItems((current) => [...current, created]);
      void persist([created]);
      return created;
    },
    [docId, persist],
  );

  const change = useCallback(
    (id: string, changes: { color?: AnnotationColor; note?: string; anchor?: Anchor }) => {
      setItems((current) => {
        const target = current.find((item) => item.id === id);
        if (!target) return current;
        const next = updateAnnotation(target, changes);
        void persist([next]);
        return current.map((item) => (item.id === id ? next : item));
      });
    },
    [persist],
  );

  const remove = useCallback(async (id: string) => {
    const ok = await deleteAnnotation(id);
    if (ok) setItems((current) => current.filter((item) => item.id !== id));
    setFailed(!ok);
    return ok;
  }, []);

  /** Thêm hoặc thay hàng loạt (nhập file). Giữ danh sách theo trang. */
  const replaceMany = useCallback(
    (records: readonly Annotation[]) => {
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const record of records) byId.set(record.id, record);
        return [...byId.values()];
      });
      void persist([...records]);
    },
    [persist],
  );

  const textByPage = useMemo(() => new Map(pages.map((p) => [p.page, p.text])), [pages]);

  /** Trạng thái neo của từng highlight chữ; loại khác luôn `ok`. Trang chưa có văn bản thì chưa kết luận. */
  const statuses = useMemo(() => {
    const map = new Map<string, AnnotationStatus>();
    for (const item of items) {
      if (item.anchor.type !== 'text') {
        map.set(item.id, 'ok');
        continue;
      }
      const text = textByPage.get(item.page);
      if (text === undefined) {
        // Trang chưa được trích văn bản (tài liệu dài, chưa lập chỉ mục): chưa kết luận mồ côi.
        map.set(item.id, 'ok');
        continue;
      }
      map.set(item.id, resolveTextAnchor(item.anchor, text).status);
    }
    return map;
  }, [items, textByPage]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt),
    [items],
  );

  return { items: sorted, statuses, failed, add, change, remove, replaceMany };
}

export type AnnotationsApi = ReturnType<typeof useAnnotations>;
