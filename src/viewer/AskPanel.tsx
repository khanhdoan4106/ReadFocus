import { useState } from 'preact/hooks';
import { formatQaClipboard } from '../core/ask/format';
import type { QaRecord } from '../core/ask/types';
import type { ProviderId } from '../core/llm/types';
import { t } from '../i18n';
import type { AskApi } from './ask';

export type AskPanelProps = {
  ask: AskApi;
  hasDocument: boolean;
  hasText: boolean;
  configured: boolean;
  semanticReady: boolean;
  providerId: ProviderId;
  onOpenSettings: () => void;
  onSelectCitation: (page: number, quote: string) => void;
};

/** Đọc chữ lúc cần để theo kịp ngôn ngữ giao diện đang chọn. */
const copyLabels = {
  get question() {
    return t.askQuestionLabel;
  },
  get answer() {
    return t.askAnswerLabel;
  },
  get citations() {
    return t.askCitationsTitle;
  },
  page: (page: number) => t.summarySectionRange(page, page),
};

export function AskPanel({
  ask,
  hasDocument,
  hasText,
  configured,
  semanticReady,
  providerId,
  onOpenSettings,
  onSelectCitation,
}: AskPanelProps) {
  const [question, setQuestion] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!hasDocument) return <p class="sidebar__empty">{t.askNoDoc}</p>;

  if (!configured) {
    return (
      <div class="summary-panel">
        <div class="summary-card">
          <p class="settings-card__hint">{t.askNotConfiguredHint}</p>
          <div class="summary-actions">
            <button type="button" class="settings-button" onClick={onOpenSettings}>
              {t.summaryOpenSettings}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const submit = (event: Event) => {
    event.preventDefault();
    if (question.trim() === '' || ask.asking) return;
    ask.ask(question);
    setQuestion('');
  };

  const copy = (record: QaRecord) => {
    void navigator.clipboard
      .writeText(formatQaClipboard(record, copyLabels))
      .then(() => {
        setCopiedId(record.id);
        setTimeout(() => setCopiedId((current) => (current === record.id ? null : current)), 2000);
      })
      .catch(() => {});
  };

  const providerLabel = t.aiProviders[providerId];

  return (
    <div class="summary-panel ask">
      <form class="ask__form" onSubmit={submit}>
        <textarea
          class="ask__input"
          rows={3}
          maxLength={1000}
          placeholder={t.askPlaceholder}
          aria-label={t.askPlaceholder}
          value={question}
          disabled={!hasText}
          onInput={(event) => setQuestion(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit(event);
            }
          }}
        />
        <div class="summary-actions">
          {ask.asking ? (
            <button type="button" class="settings-button" onClick={ask.cancel}>
              {t.askCancel}
            </button>
          ) : (
            <button
              type="submit"
              class="settings-button settings-button--primary"
              disabled={!hasText || question.trim() === ''}
            >
              {t.askSubmit}
            </button>
          )}
        </div>
      </form>

      {!hasText && <p class="settings-card__hint">{t.askNoText}</p>}
      <p class="settings-card__hint">{t.askScopeNote(semanticReady)}</p>
      <p class="settings-card__hint">{t.askSendNote(providerLabel)}</p>

      {ask.asking && (
        <p class="settings-card__hint" role="status">
          {t.askAsking}
        </p>
      )}
      {ask.error !== null && (
        <div class="settings-notice settings-notice--error" role="alert">
          {ask.error}
        </div>
      )}

      {ask.history.length === 0 ? (
        <p class="settings-card__hint">{t.askHistoryEmpty}</p>
      ) : (
        <>
          <ul class="ask__history">
            {ask.history.map((record) => (
              <li key={record.id} class="summary-card ask__item">
                <h3 class="summary-card__title">{record.question}</h3>
                {record.found ? (
                  <p class="summary-text ask__answer">{record.answer}</p>
                ) : (
                  <p class="summary-text ask__answer">{t.askNotFound}</p>
                )}

                {record.citations.length > 0 && (
                  <div class="ask__citations">
                    <span class="summary-card__meta">{t.askCitationsTitle}</span>
                    <ul class="ask__citation-list">
                      {record.citations.map((citation, index) => (
                        <li key={`${citation.page}-${index}`}>
                          <button
                            type="button"
                            class="summary-page-btn"
                            aria-label={t.askCitationOpen(citation.page)}
                            onClick={() => onSelectCitation(citation.page, citation.quote)}
                          >
                            {citation.page}
                          </button>
                          <span class="ask__quote">“{citation.quote}”</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {record.unverified && (
                  <p class="settings-notice settings-notice--error">{t.askUnverified}</p>
                )}

                <div class="summary-card__header">
                  <span class="summary-card__meta">
                    {t.askModelInfo(
                      t.aiProviders[record.providerId as ProviderId] ?? record.providerId,
                      record.model,
                    )}
                  </span>
                </div>
                <div class="summary-actions">
                  <button
                    type="button"
                    class="settings-button"
                    disabled={ask.asking}
                    onClick={() => ask.ask(record.question)}
                  >
                    {t.askRetry}
                  </button>
                  <button type="button" class="settings-button" onClick={() => copy(record)}>
                    {copiedId === record.id ? t.askCopied : t.askCopy}
                  </button>
                  <button
                    type="button"
                    class="settings-button"
                    onClick={() => ask.remove(record.id)}
                  >
                    {t.askDelete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div class="summary-actions">
            <button type="button" class="settings-button" onClick={ask.clear}>
              {t.askClearHistory}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
