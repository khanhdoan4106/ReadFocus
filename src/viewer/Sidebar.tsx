import type { TocResult } from '../core/toc';
import { vi } from '../i18n/vi';

type SidebarProps = {
  toc: TocResult | null;
  currentPage: number;
  building: boolean;
  onSelectPage: (page: number) => void;
};

export function Sidebar({ toc, currentPage, building, onSelectPage }: SidebarProps) {
  return (
    <aside class="sidebar" id="viewer-sidebar">
      <div class="sidebar__tabs" role="tablist" aria-label={vi.sidebarLabel}>
        <button
          type="button"
          role="tab"
          aria-selected="true"
          class="sidebar__tab sidebar__tab--active"
        >
          {vi.tocTitle}
        </button>
      </div>

      <div class="sidebar__panel" role="tabpanel" aria-label={vi.tocTitle}>
        {toc === null ? (
          <p class="sidebar__empty">{building ? vi.tocBuilding : vi.tocEmpty}</p>
        ) : toc.items.length === 0 ? (
          <p class="sidebar__empty">{vi.tocEmpty}</p>
        ) : (
          <ol class="toc">
            {toc.items.map((item, index) => {
              const active = currentPage >= item.startPage && currentPage <= item.endPage;
              const label = item.title || vi.tocPageRange(item.startPage, item.endPage);

              return (
                <li key={`${item.startPage}-${item.level}-${index}`}>
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
    </aside>
  );
}
