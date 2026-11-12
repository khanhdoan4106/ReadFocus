import { useState } from 'preact/hooks';
import type { LLMErrorKind, ProviderId } from '../core/llm/types';
import { formatSummaryClipboard } from '../core/summarize/format';
import type { SummaryRecord } from '../core/summarize/record';
import type { WorkEstimate } from '../core/summarize/work';
import { vi } from '../i18n/vi';
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
          <h3 class="settings-card__title">{vi.summaryNotConfiguredTitle}</h3>
          <p class="settings-card__hint">{vi.summaryNotConfiguredHint}</p>
          <div class="settings-actions">
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={onOpenSettings}
            >
              {vi.summaryOpenSettings}
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
      vi.summarySectionRange(currentSection.startPage, currentSection.endPage)
    : null;

  const providerLabel = summary
    ? (vi.aiProviders[summary.providerId as ProviderId] ?? summary.providerId)
    : '';

  return (
    <div class="summary-panel">
      {/* Khối tóm tắt toàn bộ */}
      {canSummarizeAll && (
        <div class="summary-card">
          <div class="summary-card__header">
            <h3 class="summary-card__title">{vi.summarizeAllSections}</h3>
            {summarizeAllProgress && (
              <span class="summary-card__meta">
                {vi.summarizeAllProgress(summarizeAllProgress.done, summarizeAllProgress.total)}
              </span>
            )}
          </div>

          {summarizeAllProgress ? (
            <div class="summary-card">
              <div class="summary-progress-bar">
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
                  {vi.summarizeCancel}
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
                {vi.summarizeAllSections}
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
              <span>{vi.summarizeAllFailed(summarizeAllOutcome.failed.length)}</span>
              <div class="summary-actions" style={{ marginTop: '0.4rem' }}>
                <button type="button" class="settings-button" onClick={onRetryFailed}>
                  {vi.summarizeAllRetryFailed}
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
            {sectionTitle ? vi.summaryCurrentSectionTitle(sectionTitle) : vi.summaryNoToc}
          </h3>
          {currentSection && (
            <span class="summary-card__meta">
              {vi.summarySectionRange(currentSection.startPage, currentSection.endPage)}
            </span>
          )}
        </div>

        {currentSection === null ? (
          <p class="settings-card__hint">{vi.summaryNoToc}</p>
        ) : (
          <>
            {/* Thanh tác vụ hoặc trạng thái đang chạy */}
            {loading ? (
              <div class="summary-card">
                <p class="settings-card__hint">
                  {loadingProgress
                    ? vi.summarizeSectionProgress(loadingProgress.done, loadingProgress.total)
                    : vi.loading}
                </p>
                {loadingProgress && (
                  <div class="summary-progress-bar">
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
                    {vi.summarizeCancel}
                  </button>
                </div>
              </div>
            ) : noText ? (
              <p class="settings-notice settings-notice--error">{vi.summarizeNoText}</p>
            ) : summary ? (
              <>
                <div class="summary-card__header">
                  <span class="summary-card__meta">
                    {vi.summaryModelInfo(providerLabel, summary.model)}
                  </span>
                  {isCached && <span class="summary-card__badge">{vi.summarizeFromCache}</span>}
                </div>

                <div class="summary-actions">
                  <button
                    type="button"
                    class="settings-button"
                    disabled={loading || busyElsewhere || Boolean(summarizeAllProgress)}
                    onClick={onRegenerate}
                  >
                    {vi.summarizeRegenerate}
                  </button>
                  <button type="button" class="settings-button" onClick={handleCopy}>
                    {copied ? vi.summarizeCopied : vi.summarizeCopy}
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
                  {vi.summarizeCurrentSection}
                </button>
              </div>
            )}

            {/* Thông báo lỗi */}
            {error && (
              <div class="settings-notice settings-notice--error">
                <span>{error.message}</span>
                {error.kind === 'truncated' && (
                  <div class="summary-actions" style={{ marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      class="settings-button settings-button--primary"
                      onClick={onRetry}
                    >
                      {vi.summaryRetry}
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
                    <h4 class="summary-subtitle">{vi.summaryKeyPointsTitle}</h4>
                    <ul class="summary-keypoints">
                      {summary.keyPoints.map((point, index_) => (
                        <li key={index_} class="summary-keypoint-item">
                          <span>{point.text}</span>
                          {point.pages.map((page) => (
                            <button
                              key={page}
                              type="button"
                              class="summary-page-btn"
                              title={vi.summaryPageRef(page)}
                              onClick={() => onSelectPage(page)}
                            >
                              {vi.summaryPageRef(page)}
                            </button>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {summary.terms.length > 0 && (
                  <>
                    <h4 class="summary-subtitle">{vi.summaryTermsTitle}</h4>
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
            {vi.summarizeAllConfirmTitle}
          </h2>
          <p class="consent-dialog__body">
            {vi.summarizeAllConfirmBody(
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
              {vi.summarizeAllConfirmAccept}
            </button>
            <button type="button" class="settings-button" onClick={estimateDialog.onCancel}>
              {vi.summarizeAllConfirmCancel}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
