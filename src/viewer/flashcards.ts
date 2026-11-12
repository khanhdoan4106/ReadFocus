import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { generateCardsForSection } from '../core/flashcard/ai';
import { ankiTag, cardsToAnkiCsv } from '../core/flashcard/csv';
import { draftsFromSummary, freshCards } from '../core/flashcard/from-summary';
import { boxCounts, dueCards, reviewCard } from '../core/flashcard/leitner';
import type { Box, Card } from '../core/flashcard/types';
import { isLLMError } from '../core/llm/errors';
import { getProvider } from '../core/llm';
import { resolveModel } from '../core/llm/models';
import { providerOriginPattern } from '../core/llm/permissions';
import type { AiSettings } from '../core/llm/settings';
import type { SummaryRecord } from '../core/summarize/record';
import type { TextPage } from '../core/summarize/chunk';
import { localDateKey } from '../core/stats';
import type { TocItem } from '../storage/db';
import {
  clearFlashcardsForDoc,
  deleteFlashcard,
  loadFlashcards,
  saveFlashcards,
} from '../storage/db';
import { vi } from '../i18n/vi';
import { aiErrorMessage } from './ai-errors';

export type FlashcardNotice =
  { type: 'created'; count: number } | { type: 'none' } | { type: 'no-summaries' } | null;

export type FlashcardsApi = {
  cards: readonly Card[];
  due: readonly Card[];
  counts: Record<Box, number>;
  today: string;
  busy: boolean;
  error: string | null;
  notice: FlashcardNotice;
  createFromSummaries: () => void;
  /** Gọi trực tiếp trong thao tác bấm: `permissions.request` phải đứng đầu. */
  generateWithAi: () => void;
  cancel: () => void;
  review: (card: Card, remembered: boolean) => void;
  remove: (id: string) => void;
  clear: () => void;
  exportCsv: (documentName: string) => void;
};

type Input = {
  docId: string | null;
  summaries: readonly SummaryRecord[];
  section: Pick<TocItem, 'title' | 'startPage' | 'endPage'> | null;
  pages: readonly TextPage[];
  settings: AiSettings;
  apiKey: string;
  ensureConsent: (proceed: () => void) => void;
};

function mergeCards(existing: readonly Card[], added: readonly Card[]): Card[] {
  const ids = new Set(added.map((card) => card.id));
  return [...existing.filter((card) => !ids.has(card.id)), ...added].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}

/**
 * Thẻ ghi nhớ của tài liệu đang mở. Tạo từ tóm tắt chạy hoàn toàn trên máy; tạo
 * bằng AI là một request cho mục đang đọc, chỉ khi người dùng bấm.
 */
export function useFlashcards({
  docId,
  summaries,
  section,
  pages,
  settings,
  apiKey,
  ensureConsent,
}: Input): FlashcardsApi {
  const [cards, setCards] = useState<Card[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<FlashcardNotice>(null);
  const [today, setToday] = useState(() => localDateKey());
  const runRef = useRef<{ abort: AbortController } | null>(null);
  const scopeRef = useRef(0);

  useEffect(() => {
    scopeRef.current += 1;
    const scope = scopeRef.current;
    runRef.current?.abort.abort();
    runRef.current = null;
    setCards([]);
    setBusy(false);
    setError(null);
    setNotice(null);
    setToday(localDateKey());
    if (docId === null) return;
    void loadFlashcards(docId).then((loaded) => {
      if (scopeRef.current === scope) setCards(loaded);
    });
  }, [docId]);

  useEffect(
    () => () => {
      runRef.current?.abort.abort();
    },
    [],
  );

  const addCards = useCallback(async (added: Card[], scope: number) => {
    await saveFlashcards(added);
    if (scopeRef.current !== scope) return;
    setCards((existing) => mergeCards(existing, added));
  }, []);

  const createFromSummaries = useCallback(() => {
    if (docId === null) return;
    const mine = summaries.filter((record) => record.docId === docId);
    if (mine.length === 0) {
      setNotice({ type: 'no-summaries' });
      return;
    }
    const drafts = mine.flatMap(draftsFromSummary);
    const fresh = freshCards(docId, drafts, cards, localDateKey(), Date.now());
    setError(null);
    if (fresh.length === 0) {
      setNotice({ type: 'none' });
      return;
    }
    setNotice({ type: 'created', count: fresh.length });
    void addCards(fresh, scopeRef.current);
  }, [docId, summaries, cards, addCards]);

  const run = useCallback(async () => {
    if (docId === null || section === null) return;
    const scope = scopeRef.current;
    const runDocId = docId;

    // Phải là lời gọi đầu tiên để còn nằm trong thao tác của người dùng.
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (chromeApi?.permissions) {
      const granted = await chromeApi.permissions.request({
        origins: [providerOriginPattern(settings.providerId, settings.baseUrl)],
      });
      if (scopeRef.current !== scope) return;
      if (!granted) {
        setError(vi.aiPermissionDenied);
        return;
      }
    }

    const abort = new AbortController();
    runRef.current?.abort.abort();
    const current = { abort };
    runRef.current = current;
    const isActive = () => runRef.current === current && scopeRef.current === scope;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const drafts = await generateCardsForSection({
        provider: getProvider(settings.providerId),
        config: { apiKey: apiKey.trim(), baseUrl: settings.baseUrl },
        model: resolveModel(settings.providerId, settings.model),
        title: section.title,
        startPage: section.startPage,
        endPage: section.endPage,
        pages: pages.filter(
          (page) => page.page >= section.startPage && page.page <= section.endPage,
        ),
        signal: abort.signal,
      });
      if (!isActive()) return;
      const fresh = freshCards(runDocId, drafts, cards, localDateKey(), Date.now());
      if (fresh.length === 0) {
        setNotice({ type: 'none' });
        return;
      }
      await addCards(fresh, scope);
      if (isActive()) setNotice({ type: 'created', count: fresh.length });
    } catch (caught) {
      if (!isActive()) return;
      if (isLLMError(caught) && caught.kind === 'cancelled') setError(vi.aiErrorMessages.cancelled);
      else setError(aiErrorMessage(caught, settings));
    } finally {
      if (runRef.current === current) {
        runRef.current = null;
        setBusy(false);
      }
    }
  }, [docId, section, pages, settings, apiKey, cards, addCards]);

  const generateWithAi = useCallback(() => {
    if (busy) return;
    ensureConsent(() => void run());
  }, [busy, ensureConsent, run]);

  const cancel = useCallback(() => {
    runRef.current?.abort.abort();
  }, []);

  const review = useCallback((card: Card, remembered: boolean) => {
    const updated = reviewCard(card, remembered, localDateKey(), Date.now());
    setCards((existing) => existing.map((item) => (item.id === card.id ? updated : item)));
    void saveFlashcards([updated]);
  }, []);

  const remove = useCallback((id: string) => {
    setCards((existing) => existing.filter((card) => card.id !== id));
    void deleteFlashcard(id);
  }, []);

  const clear = useCallback(() => {
    if (docId === null) return;
    setCards([]);
    setNotice(null);
    void clearFlashcardsForDoc(docId);
  }, [docId]);

  const exportCsv = useCallback(
    (documentName: string) => {
      if (cards.length === 0) return;
      const csv = cardsToAnkiCsv(cards, documentName);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ankiTag(documentName)}-flashcards.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [cards],
  );

  const due = useMemo(() => dueCards(cards, today), [cards, today]);
  const counts = useMemo(() => boxCounts(cards), [cards]);

  return {
    cards,
    due,
    counts,
    today,
    busy,
    error,
    notice,
    createFromSummaries,
    generateWithAi,
    cancel,
    review,
    remove,
    clear,
    exportCsv,
  };
}
