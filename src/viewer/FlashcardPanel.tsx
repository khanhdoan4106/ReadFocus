import { useEffect, useState } from 'preact/hooks';
import { vi } from '../i18n/vi';
import type { Box } from '../core/flashcard/types';
import type { FlashcardsApi } from './flashcards';

export type FlashcardPanelProps = {
  flashcards: FlashcardsApi;
  hasDocument: boolean;
  documentName: string;
  /** Đã cấu hình AI và có mục đang đọc để tạo thẻ. */
  canGenerate: boolean;
  aiConfigured: boolean;
  sectionLabel: string | null;
  onOpenSettings: () => void;
  onSelectPage: (page: number) => void;
};

const BOXES: readonly Box[] = [1, 2, 3, 4, 5];

export function FlashcardPanel({
  flashcards,
  hasDocument,
  documentName,
  canGenerate,
  aiConfigured,
  sectionLabel,
  onOpenSettings,
  onSelectPage,
}: FlashcardPanelProps) {
  // Phiên ôn tập chốt danh sách thẻ đến hạn lúc bắt đầu, để thẻ vừa ôn không làm nhảy thứ tự.
  const [session, setSession] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Đổi tài liệu thì bỏ phiên cũ.
  useEffect(() => {
    setSession(null);
    setRevealed(false);
  }, [hasDocument, documentName]);

  if (!hasDocument) return <p class="sidebar__empty">{vi.flashNoDoc}</p>;

  const { cards, due, counts, notice, error, busy } = flashcards;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const queue = session === null ? [] : session.filter((id) => byId.has(id));
  const current = queue.length > 0 ? byId.get(queue[0] as string) : undefined;

  if (session !== null) {
    if (current === undefined) {
      return (
        <div class="summary-panel">
          <div class="summary-card">
            <p class="summary-text" role="status">
              {vi.flashSessionDone}
            </p>
            <div class="summary-actions">
              <button
                type="button"
                class="settings-button settings-button--primary"
                onClick={() => setSession(null)}
              >
                {vi.flashBack}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const answer = (remembered: boolean) => {
      flashcards.review(current, remembered);
      setSession((ids) => (ids === null ? ids : ids.filter((id) => id !== current.id)));
      setRevealed(false);
    };

    return (
      <div class="summary-panel flash">
        <p class="settings-card__hint" role="status">
          {vi.flashProgress(queue.length)}
        </p>
        <div class="summary-card">
          <span class="summary-card__meta">{vi.flashFront}</span>
          <p class="summary-text flash__text">{current.front}</p>
          {revealed ? (
            <>
              <span class="summary-card__meta">{vi.flashBackSide}</span>
              <p class="summary-text flash__text">{current.back}</p>
              <button
                type="button"
                class="summary-page-btn"
                aria-label={vi.flashOpenPage(current.page)}
                onClick={() => onSelectPage(current.page)}
              >
                {current.page}
              </button>
            </>
          ) : null}
        </div>
        <div class="summary-actions">
          {revealed ? (
            <>
              <button
                type="button"
                class="settings-button settings-button--primary"
                onClick={() => answer(true)}
              >
                {vi.flashRemembered}
              </button>
              <button type="button" class="settings-button" onClick={() => answer(false)}>
                {vi.flashForgot}
              </button>
            </>
          ) : (
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={() => setRevealed(true)}
            >
              {vi.flashReveal}
            </button>
          )}
          <button type="button" class="settings-button" onClick={() => setSession(null)}>
            {vi.flashStop}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="summary-panel flash">
      <div class="summary-card">
        <h3 class="summary-card__title">{vi.flashSummaryTitle(cards.length, due.length)}</h3>
        {cards.length > 0 && (
          <ul class="flash__boxes" aria-label={vi.flashBoxesLabel}>
            {BOXES.map((box) => (
              <li key={box}>
                {vi.flashBox(box)}: {counts[box]}
              </li>
            ))}
          </ul>
        )}
        <div class="summary-actions">
          <button
            type="button"
            class="settings-button settings-button--primary"
            disabled={due.length === 0}
            onClick={() => {
              setSession(due.map((card) => card.id));
              setRevealed(false);
            }}
          >
            {vi.flashStartReview(due.length)}
          </button>
        </div>
        {cards.length > 0 && due.length === 0 && (
          <p class="settings-card__hint">{vi.flashNothingDue}</p>
        )}
      </div>

      <div class="summary-card">
        <div class="summary-actions">
          <button type="button" class="settings-button" onClick={flashcards.createFromSummaries}>
            {vi.flashFromSummaries}
          </button>
          {busy ? (
            <button type="button" class="settings-button" onClick={flashcards.cancel}>
              {vi.flashCancel}
            </button>
          ) : (
            <button
              type="button"
              class="settings-button"
              disabled={!aiConfigured || !canGenerate}
              onClick={flashcards.generateWithAi}
            >
              {vi.flashWithAi}
            </button>
          )}
        </div>
        <p class="settings-card__hint">{vi.flashFromSummariesHint}</p>
        {!aiConfigured ? (
          <p class="settings-card__hint">
            {vi.flashAiNotConfigured}{' '}
            <button type="button" class="settings-button" onClick={onOpenSettings}>
              {vi.summaryOpenSettings}
            </button>
          </p>
        ) : (
          <p class="settings-card__hint">
            {sectionLabel === null ? vi.flashAiNoSection : vi.flashAiHint(sectionLabel)}
          </p>
        )}
        {busy && (
          <p class="settings-card__hint" role="status">
            {vi.flashGenerating}
          </p>
        )}
        {notice !== null && (
          <p class="settings-card__hint" role="status">
            {notice.type === 'created'
              ? vi.flashCreated(notice.count)
              : notice.type === 'none'
                ? vi.flashNoNewCards
                : vi.flashNoSummaries}
          </p>
        )}
        {error !== null && (
          <div class="settings-notice settings-notice--error" role="alert">
            {error}
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div class="summary-card">
          <div class="summary-actions">
            <button
              type="button"
              class="settings-button"
              onClick={() => flashcards.exportCsv(documentName)}
            >
              {vi.flashExport}
            </button>
            <button type="button" class="settings-button" onClick={() => setShowAll(!showAll)}>
              {showAll ? vi.flashHideList : vi.flashShowList(cards.length)}
            </button>
            <button type="button" class="settings-button" onClick={flashcards.clear}>
              {vi.flashClear}
            </button>
          </div>
          <p class="settings-card__hint">{vi.flashExportHint}</p>
          {showAll && (
            <ul class="flash__list">
              {cards.map((card) => (
                <li key={card.id} class="flash__item">
                  <span class="flash__text">{card.front}</span>
                  <span class="summary-card__meta">
                    {vi.flashBox(card.box)} · {card.dueDate}
                  </span>
                  <span class="summary-actions">
                    <button
                      type="button"
                      class="summary-page-btn"
                      aria-label={vi.flashOpenPage(card.page)}
                      onClick={() => onSelectPage(card.page)}
                    >
                      {card.page}
                    </button>
                    <button
                      type="button"
                      class="settings-button"
                      onClick={() => flashcards.remove(card.id)}
                    >
                      {vi.flashDelete}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
