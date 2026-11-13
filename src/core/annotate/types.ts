export const ANNOTATION_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export type AnnotationKind = 'text' | 'area' | 'page';

/** Hình chữ nhật theo tọa độ trang đã chuẩn hóa về 0..1, nên vẽ đúng ở mọi mức zoom. */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Highlight đoạn chữ, nhiều lớp neo: offset ký tự trong text của trang, trích dẫn kèm
 * ngữ cảnh trước/sau (kiểu TextQuoteSelector của W3C) và rect để vẽ.
 */
export type TextAnchor = {
  type: 'text';
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
  rects: Rect[];
};

/** Highlight vùng: dùng cho hình, công thức, bảng và trang scan chưa OCR. */
export type AreaAnchor = { type: 'area'; rect: Rect };

/** Ghi chú của cả trang, không gắn với đoạn chữ nào. */
export type PageAnchor = { type: 'page' };

export type Anchor = TextAnchor | AreaAnchor | PageAnchor;

export type Annotation = {
  /** UUID. */
  id: string;
  docId: string;
  page: number;
  kind: AnnotationKind;
  color: AnnotationColor;
  anchor: Anchor;
  /** Ghi chú; rỗng nghĩa là chỉ highlight. */
  note: string;
  createdAt: number;
  updatedAt: number;
};
