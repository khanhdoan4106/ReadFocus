import { useMemo, useState } from 'preact/hooks';
import { searchIndex as runSearch, type SearchIndex } from '../core/search';
import { vi } from '../i18n/vi';

type SearchPanelProps = {
  index: SearchIndex | null;
  onSelectResult: (page: number, query: string, ignoreDiacritics: boolean) => void;
};

export function SearchPanel({ index, onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [ignoreDiacritics, setIgnoreDiacritics] = useState(true);

  const results = useMemo(() => {
    if (!index || query.trim() === '') return [];
    return runSearch(index, query, { ignoreDiacritics });
  }, [index, query, ignoreDiacritics]);

  return (
    <div class="search">
      <input
        class="search__input"
        type="search"
        placeholder={vi.searchPlaceholder}
        aria-label={vi.searchPlaceholder}
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      <label class="search__toggle">
        <input
          type="checkbox"
          checked={ignoreDiacritics}
          onChange={(event) => setIgnoreDiacritics(event.currentTarget.checked)}
        />
        {vi.searchIgnoreDiacritics}
      </label>

      {index === null ? (
        <p class="sidebar__empty">{vi.searchNotReady}</p>
      ) : query.trim() === '' ? (
        <p class="sidebar__empty">{vi.searchHint}</p>
      ) : results.length === 0 ? (
        <p class="sidebar__empty">{vi.searchNoResults(query.trim())}</p>
      ) : (
        <>
          <p class="search__count">{vi.searchResultCount(results.length)}</p>
          <ul class="search__results">
            {results.map((hit, index_) => (
              <li key={`${hit.page}-${index_}`}>
                <button
                  type="button"
                  class="search__result"
                  onClick={() => onSelectResult(hit.page, query, ignoreDiacritics)}
                >
                  <span class="search__page">{vi.tocPageRange(hit.page, hit.page)}</span>
                  <span class="search__snippet">{hit.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
