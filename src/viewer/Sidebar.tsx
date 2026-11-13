import { useEffect, useState } from 'preact/hooks';
import { estimateItemMinutes, estimateRemainingTime, roundedMinutes } from '../core/reading-time';
import type { SearchIndex } from '../core/search';
import type { TocResult } from '../core/toc';
import { t } from '../i18n';
import { AskPanel, type AskPanelProps } from './AskPanel';
import { FlashcardPanel, type FlashcardPanelProps } from './FlashcardPanel';
import { FocusPanel, type FocusPanelProps } from './FocusPanel';
import { SearchPanel } from './SearchPanel';
import type { SemanticApi } from './semantic';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';
import { SummaryPanel, type SummaryPanelProps } from './SummaryPanel';

type SidebarTab = 'toc' | 'summary' | 'ask' | 'flash' | 'search' | 'focus' | 'settings';

type SidebarProps = {
  toc: TocResult | null;
  currentPage: number;
  building: boolean;
  index: SearchIndex | null;
  wordsPerMinute: number;
  focus: FocusPanelProps;
  settings: SettingsPanelProps;
  summary: SummaryPanelProps;
  semantic: SemanticApi;
  askPanel: AskPanelProps;
  flashPanel: FlashcardPanelProps;
  summarizedSpans: ReadonlySet<string>;
  searchRequest: number;
  onSelectPage: (page: number) => void;
  onSelectResult: (page: number, query: string, ignoreDiacritics: boolean) => void;
};

export function Sidebar({
  toc,
  currentPage,
  building,
  index,
  wordsPerMinute,
  focus,
  settings,
  summary,
  semantic,
  askPanel,
  flashPanel,
  summarizedSpans,
  searchRequest,
  onSelectPage,
  onSelectResult,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('toc');
  const remaining =
    toc === null ? null : estimateRemainingTime(toc.items, currentPage, wordsPerMinute);

  // Phím "/" mở thẳng tab Tìm kiếm rồi đưa con trỏ vào ô nhập.
  useEffect(() => {
    if (searchRequest > 0) setTab('search');
  }, [searchRequest]);

  return (
    <aside class="sidebar" id="viewer-sidebar">
      <div class="sidebar__tabs" role="tablist" aria-label={t.sidebarLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'toc'}
          class={`sidebar__tab${tab === 'toc' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('toc')}
        >
          {t.tocTitle}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'summary'}
          class={`sidebar__tab${tab === 'summary' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('summary')}
        >
          {t.summaryTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ask'}
          class={`sidebar__tab${tab === 'ask' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('ask')}
        >
          {t.askTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'flash'}
          class={`sidebar__tab${tab === 'flash' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('flash')}
        >
          {t.flashTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'search'}
          class={`sidebar__tab${tab === 'search' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('search')}
        >
          {t.searchTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'focus'}
          class={`sidebar__tab${tab === 'focus' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('focus')}
        >
          {t.focusTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'settings'}
          class={`sidebar__tab${tab === 'settings' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('settings')}
        >
          {t.settingsTab}
        </button>
      </div>

      {tab === 'toc' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.tocTitle}>
          {toc === null ? (
            <p class="sidebar__empty">{building ? t.tocBuilding : t.tocEmpty}</p>
          ) : toc.items.length === 0 ? (
            <p class="sidebar__empty">{t.tocEmpty}</p>
          ) : (
            <>
              {remaining !== null && wordsPerMinute > 0 && (
                <dl class="reading">
                  <div class="reading__row">
                    <dt>{t.readingSectionLabel}</dt>
                    <dd>{t.readingMinutes(roundedMinutes(remaining.sectionMinutes))}</dd>
                  </div>
                  <div class="reading__row">
                    <dt>{t.readingTotalLabel}</dt>
                    <dd>{t.readingMinutes(roundedMinutes(remaining.totalMinutes))}</dd>
                  </div>
                </dl>
              )}
              <ol class="toc">
                {toc.items.map((item, index_) => {
                  const active = currentPage >= item.startPage && currentPage <= item.endPage;
                  const label = item.title || t.tocPageRange(item.startPage, item.endPage);
                  const itemMinutes = roundedMinutes(estimateItemMinutes(item, wordsPerMinute));
                  const hasSummary = summarizedSpans.has(`${item.startPage}-${item.endPage}`);

                  return (
                    <li key={`${item.startPage}-${item.level}-${index_}`}>
                      <button
                        type="button"
                        class={`toc__item${active ? ' toc__item--active' : ''}`}
                        style={{ paddingLeft: `${0.6 + Math.min(item.level - 1, 4) * 0.9}rem` }}
                        aria-current={active ? 'location' : undefined}
                        title={label}
                        onClick={() => onSelectPage(item.startPage)}
                      >
                        <span class="toc__title">{label}</span>
                        {hasSummary && (
                          <span
                            class="toc__summary-badge"
                            title={t.summaryBadgeTitle}
                            aria-label={t.summaryBadgeTitle}
                          >
                            ✦
                          </span>
                        )}
                        {itemMinutes > 0 && (
                          <span class="toc__time">{t.readingMinutes(itemMinutes)}</span>
                        )}
                        <span class="toc__page">{item.startPage}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      ) : tab === 'summary' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.summaryTab}>
          <SummaryPanel {...summary} onOpenSettings={() => setTab('settings')} />
        </div>
      ) : tab === 'ask' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.askTab}>
          <AskPanel {...askPanel} onOpenSettings={() => setTab('settings')} />
        </div>
      ) : tab === 'flash' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.flashTab}>
          <FlashcardPanel {...flashPanel} onOpenSettings={() => setTab('settings')} />
        </div>
      ) : tab === 'search' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.searchTab}>
          <SearchPanel
            index={index}
            semantic={semantic}
            focusRequest={searchRequest}
            onSelectResult={onSelectResult}
          />
        </div>
      ) : tab === 'focus' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.focusTab}>
          <FocusPanel {...focus} />
        </div>
      ) : (
        <div class="sidebar__panel" role="tabpanel" aria-label={t.settingsTab}>
          <SettingsPanel {...settings} />
        </div>
      )}
    </aside>
  );
}
