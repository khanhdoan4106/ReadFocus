import { useState } from 'preact/hooks';
import type { SearchIndex } from '../core/search';
import type { TocResult } from '../core/toc';
import { vi } from '../i18n/vi';
import { SearchPanel } from './SearchPanel';

type SidebarTab = 'toc' | 'search';

type SidebarProps = {
  toc: TocResult | null;
  currentPage: number;
  building: boolean;
  index: SearchIndex | null;
  onSelectPage: (page: number) => void;
  onSelectResult: (page: number, query: string, ignoreDiacritics: boolean) => void;
};

export function Sidebar({
  toc,
  currentPage,
  building,
  index,
  onSelectPage,
  onSelectResult,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('toc');

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
          aria-selected={tab === 'search'}
          class={`sidebar__tab${tab === 'search' ? ' sidebar__tab--active' : ''}`}
          onClick={() => setTab('search')}
        >
          {vi.searchTab}
        </button>
      </div>

      {tab === 'toc' ? (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.tocTitle}>
          {toc === null ? (
            <p class="sidebar__empty">{building ? vi.tocBuilding : vi.tocEmpty}</p>
          ) : toc.items.length === 0 ? (
            <p class="sidebar__empty">{vi.tocEmpty}</p>
          ) : (
            <ol class="toc">
              {toc.items.map((item, index_) => {
                const active = currentPage >= item.startPage && currentPage <= item.endPage;
                const label = item.title || vi.tocPageRange(item.startPage, item.endPage);

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
                      <span class="toc__page">{item.startPage}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : (
        <div class="sidebar__panel" role="tabpanel" aria-label={vi.searchTab}>
          <SearchPanel index={index} onSelectResult={onSelectResult} />
        </div>
      )}
    </aside>
  );
}
