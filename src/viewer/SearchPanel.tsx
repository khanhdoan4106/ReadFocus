import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { chunkPreview, type RetrievedChunk } from '../core/embed/retrieve';
import { searchIndex as runSearch, type SearchIndex } from '../core/search';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import type { SemanticApi } from './semantic';

type SearchPanelProps = {
  index: SearchIndex | null;
  semantic: SemanticApi;
  focusRequest: number;
  onSelectResult: (page: number, query: string, ignoreDiacritics: boolean) => void;
};

const SEMANTIC_LIMIT = 10;
const KEYWORD_POOL = 30;

export function SearchPanel({ index, semantic, focusRequest, onSelectResult }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [ignoreDiacritics, setIgnoreDiacritics] = useState(true);
  const [semanticOn, setSemanticOn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [semanticResults, setSemanticResults] = useState<{
    query: string;
    items: RetrievedChunk[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  // Đổi tài liệu hoặc nguồn embedding thì kết quả theo ý nghĩa cũ không còn đúng.
  useEffect(() => {
    setSemanticResults(null);
  }, [semantic.chunks, semantic.providerId, semantic.model]);

  const building = semantic.progress !== null;
  const indexReady = semantic.state === 'ready';
  const canUseSemantic =
    semantic.state === 'ready' || semantic.state === 'none' || semantic.state === 'partial';
  const showSemantic = semanticOn && indexReady;

  const keywordResults = useMemo(() => {
    if (!index || query.trim() === '') return [];
    return runSearch(index, query, { ignoreDiacritics });
  }, [index, query, ignoreDiacritics]);

  const submit = (event: Event) => {
    event.preventDefault();
    if (!showSemantic || query.trim() === '' || searching) return;
    const text = query.trim();
    const hits = index
      ? runSearch(index, text, { ignoreDiacritics, limit: KEYWORD_POOL }).map((hit) => ({
          page: hit.page,
          text: hit.text,
        }))
      : [];
    setSearching(true);
    void semantic.search(text, hits, SEMANTIC_LIMIT).then((items) => {
      if (!mountedRef.current) return;
      setSearching(false);
      setSemanticResults(items === null ? null : { query: text, items });
    });
  };

  const provider = t.aiProviders[semantic.providerId];

  return (
    <div class="search">
      <form class="search__form" onSubmit={submit}>
        <input
          ref={inputRef}
          class="search__input"
          type="search"
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        {showSemantic && (
          <button type="submit" class="notice__button" disabled={searching}>
            {t.searchSubmit}
          </button>
        )}
      </form>
      <label class="search__toggle">
        <input
          type="checkbox"
          checked={ignoreDiacritics}
          onChange={(event) => setIgnoreDiacritics(event.currentTarget.checked)}
        />
        {t.searchIgnoreDiacritics}
      </label>
      <label class="search__toggle">
        <input
          type="checkbox"
          checked={semanticOn}
          onChange={(event) => setSemanticOn(event.currentTarget.checked)}
        />
        {t.semanticToggle}
      </label>

      {semanticOn && (
        <div class="search__semantic">
          {semantic.state === 'unsupported' && (
            <p class="sidebar__empty">{t.semanticUnsupported}</p>
          )}
          {semantic.state === 'missing-key' && <p class="sidebar__empty">{t.semanticMissingKey}</p>}
          {semantic.state === 'empty' && <p class="sidebar__empty">{t.semanticEmpty}</p>}

          {building && semantic.progress ? (
            <div class="notice__progress">
              <progress value={semantic.progress.done} max={semantic.progress.total} />
              <span>{t.semanticBuilding(semantic.progress.done, semantic.progress.total)}</span>
              <button type="button" class="notice__button" onClick={semantic.cancel}>
                {t.semanticCancel}
              </button>
            </div>
          ) : (
            canUseSemantic &&
            !indexReady && (
              <>
                <p class="sidebar__empty">
                  {semantic.state === 'none'
                    ? t.semanticNoIndex
                    : t.semanticPartialIndex(semantic.pending.chunks)}
                </p>
                <button type="button" class="notice__button" onClick={() => setConfirmOpen(true)}>
                  {semantic.state === 'none' ? t.semanticBuild : t.semanticBuildMore}
                </button>
              </>
            )
          )}

          {indexReady && <p class="search__note">{t.semanticToggleHint(provider)}</p>}
          {semantic.error !== null && (
            <p class="notice__error" role="alert">
              {semantic.error}
            </p>
          )}
        </div>
      )}

      {showSemantic ? (
        searching ? (
          <p class="sidebar__empty" role="status">
            {t.semanticSearching}
          </p>
        ) : semanticResults === null ? (
          <p class="sidebar__empty">{t.semanticReady}</p>
        ) : semanticResults.items.length === 0 ? (
          <p class="sidebar__empty">{t.searchNoResults(semanticResults.query)}</p>
        ) : (
          <>
            <p class="search__count">{t.searchResultCount(semanticResults.items.length)}</p>
            <p class="search__note">{t.semanticHybridNote}</p>
            <ul class="search__results">
              {semanticResults.items.map(({ chunk }) => (
                <li key={chunk.id}>
                  <button
                    type="button"
                    class="search__result"
                    onClick={() =>
                      onSelectResult(chunk.page, semanticResults.query, ignoreDiacritics)
                    }
                  >
                    <span class="search__page">{t.tocPageRange(chunk.page, chunk.page)}</span>
                    <span class="search__snippet">{chunkPreview(chunk.text)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : index === null ? (
        <p class="sidebar__empty">{t.searchNotReady}</p>
      ) : query.trim() === '' ? (
        <p class="sidebar__empty">{t.searchHint}</p>
      ) : keywordResults.length === 0 ? (
        <p class="sidebar__empty">{t.searchNoResults(query.trim())}</p>
      ) : (
        <>
          <p class="search__count">{t.searchResultCount(keywordResults.length)}</p>
          <ul class="search__results">
            {keywordResults.map((hit, index_) => (
              <li key={`${hit.page}-${index_}`}>
                <button
                  type="button"
                  class="search__result"
                  onClick={() => onSelectResult(hit.page, query, ignoreDiacritics)}
                >
                  <span class="search__page">{t.tocPageRange(hit.page, hit.page)}</span>
                  <span class="search__snippet">{hit.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirmOpen && (
        <Dialog titleId="semantic-confirm-title" onClose={() => setConfirmOpen(false)}>
          <h2 class="consent-dialog__title" id="semantic-confirm-title">
            {t.semanticConfirmTitle}
          </h2>
          <p class="consent-dialog__body">
            {t.semanticConfirmBody(
              semantic.pending.chunks,
              semantic.pending.requests,
              provider,
              semantic.model,
            )}
          </p>
          <div class="consent-dialog__actions">
            <button
              type="button"
              class="settings-button settings-button--primary"
              onClick={() => {
                setConfirmOpen(false);
                void semantic.build();
              }}
            >
              {t.semanticConfirmAccept}
            </button>
            <button type="button" class="settings-button" onClick={() => setConfirmOpen(false)}>
              {t.semanticConfirmCancel}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
