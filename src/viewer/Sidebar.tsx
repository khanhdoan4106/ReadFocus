import { useEffect, useState } from 'preact/hooks';
import { estimateItemMinutes, estimateRemainingTime, roundedMinutes } from '../core/reading-time';
import type { SearchIndex } from '../core/search';
import type { TocResult } from '../core/toc';
import { vi } from '../i18n/vi';
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
      <div class="sidebar__tabs" role="tablist" aria-label={vi.sidebarLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'toc'}
          class={`sidebar__tab${tab === 'toc' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('toc')}
        >
          {vi.tocTitle}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'summary'}
          class={`sidebar__tab${tab === 'summary' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('summary')}
        >
          {vi.summaryTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ask'}
          class={`sidebar__tab${tab === 'ask' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('ask')}
        >
          {vi.askTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'flash'}
          class={`sidebar__tab${tab === 'flash' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('flash')}
        >
          {vi.flashTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'search'}
          class={`sidebar__tab${tab === 'search' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('search')}
        >
          {vi.searchTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'focus'}
          class={`sidebar__tab${tab === 'focus' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('focus')}
        >
          {vi.focusTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'settings'}
          class={`sidebar__tab${tab === 'settings' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('settings')}
        >
          {vi.settingsTab}
        </button>
      </div>

      {tab === 'toc' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.tocTitle}>
          {toc === null ? (
            <p class="sidebar__empty">{building ? vi.tocBuilding : vi.tocEmpty}</p>
          ) : toc.items.length === 0 ? (
            <p class="sidebar__empty">{vi.tocEmpty}</p>
          ) : (
            <>
              {remaining !== null && wordsPerMinute > 0 && (
                <dl class="reading">
                  <div class="reading__row">
                    <dt>{vi.readingSectionLabel}</dt>
                    <dd>{vi.readingMinutes(roundedMinutes(remaining.sectionMinutes))}</dd>
                  </div>
                  <div class="reading__row">
                    <dt>{vi.readingTotalLabel}</dt>
                    <dd>{vi.readingMinutes(roundedMinutes(remaining.totalMinutes))}</dd>
                  </div>
                </dl>
              )}
              <ol class="toc">
                {toc.items.map((item, index_) => {
                  const active = currentPage >= item.startPage && currentPage <= item.endPage;
                  const label = item.title || vi.tocPageRange(item.startPage, item.endPage);
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
                            title={vi.summaryBadgeTitle}
                            aria-label={vi.summaryBadgeTitle}
                          >
                            ✦
                          </span>
                        )}
                        {itemMinutes > 0 && (
                          <span class="toc__time">{vi.readingMinutes(itemMinutes)}</span>
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
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.summaryTab}>
          <SummaryPanel {...summary} onOpenSettings={() => setTab('settings')} />
        </div>
      ) : tab === 'ask' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.askTab}>
          <AskPanel {...askPanel} onOpenSettings={() => setTab('settings')} />
        </div>
      ) : tab === 'flash' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.flashTab}>
          <FlashcardPanel {...flashPanel} onOpenSettings={() => setTab('settings')} />
        </div>
      ) : tab === 'search' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.searchTab}>
          <SearchPanel
            index={index}
            semantic={semantic}
            focusRequest={searchRequest}
            onSelectResult={onSelectResult}
          />
        </div>
      ) : tab === 'focus' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.focusTab}>
          <FocusPanel {...focus} />
        </div>
      ) : (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.settingsTab}>
          <SettingsPanel {...settings} />
        </div>
      )}
    </aside>
  );
}
