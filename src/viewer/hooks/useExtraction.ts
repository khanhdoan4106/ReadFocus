import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useRef, useState } from 'preact/hooks';
import type { TextPage } from '../../core/summarize/chunk';
import { hasTextLayer, type PageRange } from '../../core/ocr/pages';
import { buildProfile, type PageSample } from '../../core/profile';
import { buildSearchIndex, type SearchIndex } from '../../core/search';
import { countWords } from '../../core/text';
import { buildToc, type TocPage, type TocResult } from '../../core/toc';
import { vi } from '../../i18n/vi';
import { clearPageTexts, savePageTexts } from '../../storage/db';
import { extractRange, INDEX_PAGE_LIMIT, readOutline } from '../extract';

import type { RefObject } from 'preact';
import type { Analysis, IndexRange } from './types';

type Input = {
  /** Văn bản OCR đã lưu, dùng thay cho lớp chữ trống khi lập chỉ mục. */
  ocrTextRef: RefObject<Map<number, string>>;
  /** Khoảng trang đã lập chỉ mục gần nhất, để lập lại sau OCR. */
  indexedRangeRef: RefObject<PageRange | null>;
};

/**
 * Trích văn bản, phân loại tài liệu và dựng mục lục, chỉ mục tìm kiếm, số chữ mỗi trang.
 * Mỗi lượt trích mang một `token`; mở file khác hoặc đóng thì token đổi và lượt cũ tự dừng.
 */
export function useExtraction({ ocrTextRef, indexedRangeRef }: Input) {
  const [analysis, setAnalysis] = useState<Analysis>({ phase: 'idle' });
  const [indexRange, setIndexRange] = useState<IndexRange | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocResult | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [pageWords, setPageWords] = useState<Record<number, number>>({});
  const [extractedPages, setExtractedPages] = useState<TextPage[]>([]);

  // Mỗi lần mở tài liệu hoặc lập chỉ mục lại thì tăng lên để dừng lượt trích cũ.
  const analysisTokenRef = useRef(0);

  const runExtraction = useCallback(
    async (pdfDoc: PDFDocumentProxy, from: number, to: number, id: string | null) => {
      const token = analysisTokenRef.current + 1;
      analysisTokenRef.current = token;
      const total = to - from + 1;
      setRangeError(null);
      setAnalysis({ phase: 'extracting', done: 0, total });

      if (id) void clearPageTexts(id);
      indexedRangeRef.current = { from, to };

      const pending: { page: number; text: string }[] = [];
      const flush = () => {
        if (!id || pending.length === 0) return;
        void savePageTexts(id, pending.splice(0, pending.length));
      };

      try {
        const outline = await readOutline(pdfDoc);
        const outlineDepth = outline.reduce((max, entry) => Math.max(max, entry.level), 0);
        const samples: PageSample[] = [];
        const tocPages: TocPage[] = [];

        await extractRange(pdfDoc, {
          from,
          to,
          shouldStop: () => analysisTokenRef.current !== token,
          onPage: (extracted) => {
            // Trang scan đã OCR: dùng chữ OCR (đã lưu riêng, không ghi đè bản ghi OCR).
            const ocrText = ocrTextRef.current.get(extracted.page);
            const useOcr = ocrText !== undefined && !hasTextLayer(extracted);
            const page = useOcr ? { ...extracted, text: ocrText, lines: [] } : extracted;
            samples.push(page);
            tocPages.push({
              page: page.page,
              text: page.text,
              lines: page.lines,
              width: page.width,
              height: page.height,
            });
            if (!useOcr) pending.push({ page: page.page, text: page.text });
            if (pending.length >= 10) flush();
            if (analysisTokenRef.current === token) {
              setAnalysis({ phase: 'extracting', done: samples.length, total });
            }
          },
        });
        flush();

        if (analysisTokenRef.current !== token) return;
        const profile = buildProfile(samples, { outlineDepth });
        setAnalysis({ phase: 'done', profile });
        setToc(
          buildToc({
            pages: tocPages,
            outline,
            pageCount: pdfDoc.numPages,
            kind: profile.kind,
          }),
        );
        setSearchIndex(
          buildSearchIndex(tocPages.map((page) => ({ page: page.page, text: page.text }))),
        );
        setPageWords(
          Object.fromEntries(tocPages.map((page) => [page.page, countWords(page.text)])),
        );
        setExtractedPages(tocPages.map((page) => ({ page: page.page, text: page.text })));
      } catch {
        flush();
        if (analysisTokenRef.current === token) setAnalysis({ phase: 'error' });
      }
    },
    [],
  );

  /** Tài liệu dài chưa trích văn bản vẫn hiện được outline ngay. */
  const loadOutlineToc = useCallback(async (pdfDoc: PDFDocumentProxy, token: number) => {
    const outline = await readOutline(pdfDoc);
    if (analysisTokenRef.current !== token || outline.length === 0) return;
    setToc(buildToc({ pages: [], outline, pageCount: pdfDoc.numPages }));
  }, []);

  const startIndexing = (doc: PDFDocumentProxy | null, docId: string | null) => {
    if (!doc || !indexRange) return;

    const from = Number.parseInt(indexRange.from, 10);
    const to = Number.parseInt(indexRange.to, 10);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to < from ||
      to > doc.numPages
    ) {
      setRangeError(vi.indexRangeInvalid);
      return;
    }
    if (to - from + 1 > INDEX_PAGE_LIMIT) {
      setRangeError(vi.indexRangeTooLong(INDEX_PAGE_LIMIT));
      return;
    }

    setIndexRange(null);
    void runExtraction(doc, from, to, docId);
  };

  /** Tài liệu mới: xoá kết quả cũ rồi bắt đầu trích (tài liệu dài thì chờ người dùng chọn khoảng trang). */
  const begin = useCallback(
    (pdfDoc: PDFDocumentProxy, hash: string | null) => {
      setPageWords({});
      setExtractedPages([]);
      analysisTokenRef.current += 1;
      const token = analysisTokenRef.current;
      setToc(null);
      setSearchIndex(null);
      setIndexRange(null);
      setRangeError(null);
      setAnalysis({ phase: 'idle' });

      if (pdfDoc.numPages > INDEX_PAGE_LIMIT) {
        setIndexRange({ from: '1', to: String(INDEX_PAGE_LIMIT) });
        void loadOutlineToc(pdfDoc, token);
      } else {
        void runExtraction(pdfDoc, 1, pdfDoc.numPages, hash);
      }
    },
    [loadOutlineToc, runExtraction],
  );

  /** Dừng lượt trích đang chạy (đóng hoặc xoá tài liệu, đóng viewer). */
  const invalidate = useCallback(() => {
    analysisTokenRef.current += 1;
  }, []);

  /** Bỏ mục lục, chỉ mục và văn bản đã trích của tài liệu đã đóng hoặc đã xoá. */
  const clear = useCallback(() => {
    setToc(null);
    setSearchIndex(null);
    setAnalysis({ phase: 'idle' });
    setPageWords({});
    setExtractedPages([]);
  }, []);

  /** Bỏ lựa chọn khoảng trang và lỗi của nó. */
  const clearRange = useCallback(() => {
    setIndexRange(null);
    setRangeError(null);
  }, []);

  return {
    analysis,
    indexRange,
    setIndexRange,
    rangeError,
    toc,
    searchIndex,
    pageWords,
    extractedPages,
    runExtraction,
    startIndexing,
    begin,
    invalidate,
    clear,
    clearRange,
  };
}
