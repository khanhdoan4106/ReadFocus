import { useState } from 'preact/hooks';
import type { LLMErrorKind, ProviderId } from '../core/llm/types';
import { formatSummaryClipboard } from '../core/summarize/format';
import type { SummaryRecord } from '../core/summarize/record';
import type { WorkEstimate } from '../core/summarize/work';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import type { TocItem } from '../storage/db';

export type SummaryPanelProps = {
  configured: boolean;
  onOpenSettings: () => void;
  currentSection: TocItem | null;
  summary: SummaryRecord | null;
  isCached: boolean;
  loading: boolean;
  /** Một mục khác đang được tóm tắt; khoá các nút bắt đầu. */
  busyElsewhere: boolean;
  loadingProgress: { done: number; total: number } | null;
  error: { kind: LLMErrorKind; message: string } | null;
  noText: boolean;
  onSummarize: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSelectPage: (page: number) => void;
  canSummarizeAll: boolean;
  summarizeAllProgress: { done: number; total: number } | null;
  onSummarizeAllClick: () => void;
  onCancelSummarizeAll: () => void;
  summarizeAllOutcome: {
    failed: TocItem[];
    error: { kind: LLMErrorKind; message: string } | null;
  } | null;
  onRetryFailed: () => void;
  estimateDialog: {
    open: boolean;
    estimate: WorkEstimate | null;
    sectionsCount: number;
    cachedCount: number;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
};

export function SummaryPanel({
  configured,
  onOpenSettings,
  currentSection,
  summary,
  isCached,
  loading,
  busyElsewhere,
  loadingProgress,
  error,
  noText,
  onSummarize,
  onRegenerate,
  onCancel,
  onRetry,
  onSelectPage,
  canSummarizeAll,
  summarizeAllProgress,
  onSummarizeAllClick,
  onCancelSummarizeAll,
  summarizeAllOutcome,
  onRetryFailed,
  estimateDialog,
}: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  // 1. Chưa cấu hình AI: chỉ hiện hướng dẫn mở Cài đặt → AI.
  if (!configured) {
    return (
      <div class="summary-panel">
        <div class="settings-card">
          <h3 class="settings-card__title">{t.summaryNotConfiguredTitle}</h3>
          <p class="settings-card__hint">{t.summaryNotConfiguredHint}</p>
          <div class="settings-actions">
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={onOpenSettings}
            >
              {t.summaryOpenSettings}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    if (!summary) return;
    const text = formatSummaryClipboard(summary);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sectionTitle = currentSection
    ? currentSection.title ||
      t.summarySectionRange(currentSection.startPage, currentSection.endPage)
    : null;

  const providerLabel = summary
    ? (t.aiProviders[summary.providerId as ProviderId] ?? summary.providerId)
    : '';

  return (
    <div class="summary-panel">
      {/* Khối tóm tắt toàn bộ */}
      {canSummarizeAll && (
        <div class="summary-card">
          <div class="summary-card__header">
            <h3 class="summary-card__title">{t.summarizeAllSections}</h3>
            {summarizeAllProgress && (
              <span class="summary-card__meta">
                {t.summarizeAllProgress(summarizeAllProgress.done, summarizeAllProgress.total)}
              </span>
            )}
          </div>

          {summarizeAllProgress ? (
            <div class="summary-card">
              <div
                class="summary-progress-bar"
                role="progressbar"
                aria-label={t.summarizeAllProgress(
                  summarizeAllProgress.done,
                  summarizeAllProgress.total,
                )}
                aria-valuemin={0}
                aria-valuemax={summarizeAllProgress.total}
                aria-valuenow={summarizeAllProgress.done}
              >
                <div
                  class="summary-progress-fill"
                  style={{
                    width: `${Math.round(
                      (summarizeAllProgress.done / Math.max(1, summarizeAllProgress.total)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <div class="summary-actions">
                <button type="button" class="settings-button" onClick={onCancelSummarizeAll}>
                  {t.summarizeCancel}
                </button>
              </div>
            </div>
          ) : (
            <div class="summary-actions">
              <button
                type="button"
                class="settings-button settings-button--primary"
                disabled={loading || busyElsewhere}
                onClick={onSummarizeAllClick}
              >
                {t.summarizeAllSections}
              </button>
            </div>
          )}

          {summarizeAllOutcome?.error && (
            <div class="settings-notice settings-notice--error" role="alert">
              {summarizeAllOutcome.error.message}
            </div>
          )}
          {summarizeAllOutcome && summarizeAllOutcome.failed.length > 0 && (
            <div class="settings-notice settings-notice--error" role="alert">
              <span>{t.summarizeAllFailed(summarizeAllOutcome.failed.length)}</span>
              <div class="summary-actions" style={{ marginTop: '0.4rem' }}>
                <button type="button" class="settings-button" onClick={onRetryFailed}>
                  {t.summarizeAllRetryFailed}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Khối mục đang đọc */}
      <div class="summary-card">
        <div class="summary-card__header">
          <h3 class="summary-card__title">
            {sectionTitle ? t.summaryCurrentSectionTitle(sectionTitle) : t.summaryNoToc}
          </h3>
          {currentSection && (
            <span class="summary-card__meta">
              {t.summarySectionRange(currentSection.startPage, currentSection.endPage)}
            </span>
          )}
        </div>

        {currentSection === null ? (
          <p class="settings-card__hint">{t.summaryNoToc}</p>
        ) : (
          <>
            {/* Thanh tác vụ hoặc trạng thái đang chạy */}
            {loading ? (
              <div class="summary-card">
                <p class="settings-card__hint">
                  {loadingProgress
                    ? t.summarizeSectionProgress(loadingProgress.done, loadingProgress.total)
                    : t.loading}
                </p>
                {loadingProgress && (
                  <div
                    class="summary-progress-bar"
                    role="progressbar"
                    aria-label={t.summarizeSectionProgress(
                      loadingProgress.done,
                      loadingProgress.total,
                    )}
                    aria-valuemin={0}
                    aria-valuemax={loadingProgress.total}
                    aria-valuenow={loadingProgress.done}
                  >
                    <div
                      class="summary-progress-fill"
                      style={{
                        width: `${Math.round(
                          (loadingProgress.done / Math.max(1, loadingProgress.total)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                )}
                <div class="summary-actions">
                  <button type="button" class="settings-button" onClick={onCancel}>
                    {t.summarizeCancel}
                  </button>
                </div>
              </div>
            ) : noText ? (
              <p class="settings-notice settings-notice--error">{t.summarizeNoText}</p>
            ) : summary ? (
              <>
                <div class="summary-card__header">
                  <span class="summary-card__meta">
                    {t.summaryModelInfo(providerLabel, summary.model)}
                  </span>
                  {isCached && <span class="summary-card__badge">{t.summarizeFromCache}</span>}
                </div>

                <div class="summary-actions">
                  <button
                    type="button"
                    class="settings-button"
                    disabled={loading || busyElsewhere || Boolean(summarizeAllProgress)}
                    onClick={onRegenerate}
                  >
                    {t.summarizeRegenerate}
                  </button>
                  <button type="button" class="settings-button" onClick={handleCopy}>
                    {copied ? t.summarizeCopied : t.summarizeCopy}
                  </button>
                </div>
              </>
            ) : (
              <div class="summary-actions">
                <button
                  type="button"
                  class="settings-button settings-button--primary"
                  disabled={loading || busyElsewhere || Boolean(summarizeAllProgress)}
                  onClick={onSummarize}
                >
                  {t.summarizeCurrentSection}
                </button>
              </div>
            )}

            {/* Thông báo lỗi */}
            {error && (
              <div class="settings-notice settings-notice--error" role="alert">
                <span>{error.message}</span>
                {error.kind === 'truncated' && (
                  <div class="summary-actions" style={{ marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      class="settings-button settings-button--primary"
                      onClick={onRetry}
                    >
                      {t.summaryRetry}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Nội dung kết quả tóm tắt (chỉ hiển thị text thuần, không HTML/markdown) */}
            {summary && !loading && (
              <div class="summary-content">
                <p class="summary-text">{summary.summary}</p>

                {summary.keyPoints.length > 0 && (
                  <>
                    <h4 class="summary-subtitle">{t.summaryKeyPointsTitle}</h4>
                    <ul class="summary-keypoints">
                      {summary.keyPoints.map((point, index_) => (
                        <li key={index_} class="summary-keypoint-item">
                          <span>{point.text}</span>
                          {point.pages.map((page) => (
                            <button
                              key={page}
                              type="button"
                              class="summary-page-btn"
                              title={t.summaryPageRef(page)}
                              onClick={() => onSelectPage(page)}
                            >
                              {t.summaryPageRef(page)}
                            </button>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {summary.terms.length > 0 && (
                  <>
                    <h4 class="summary-subtitle">{t.summaryTermsTitle}</h4>
                    <dl class="summary-terms">
                      {summary.terms.map((term, index_) => (
                        <div key={index_} class="summary-term-row">
                          <dt>{term.term}</dt>
                          <dd>{term.definition}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hộp xác nhận tóm tắt toàn bộ */}
      {estimateDialog?.open && estimateDialog.estimate && (
        <Dialog titleId="summary-estimate-title" onClose={estimateDialog.onCancel}>
          <h2 class="consent-dialog__title" id="summary-estimate-title">
            {t.summarizeAllConfirmTitle}
          </h2>
          <p class="consent-dialog__body">
            {t.summarizeAllConfirmBody(
              estimateDialog.sectionsCount,
              estimateDialog.cachedCount,
              estimateDialog.estimate.requests,
              estimateDialog.estimate.inputTokens,
            )}
          </p>
          <div class="consent-dialog__actions">
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={estimateDialog.onConfirm}
            >
              {t.summarizeAllConfirmAccept}
            </button>
            <button type="button" class="settings-button" onClick={estimateDialog.onCancel}>
              {t.summarizeAllConfirmCancel}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
