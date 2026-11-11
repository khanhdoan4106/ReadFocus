import type { AiSettings, SummaryLanguage } from '../core/llm/settings';
import { PROVIDERS } from '../core/llm/settings';
import type { ProviderId } from '../core/llm/types';
import type { ThemePreference } from '../core/theme';
import { vi } from '../i18n/vi';

export type AiPanelProps = {
  settings: AiSettings;
  apiKey: string;
  keyVisible: boolean;
  supported: boolean;
  busy: boolean;
  notice: { tone: 'ok' | 'error'; message: string } | null;
  onChangeProvider: (providerId: ProviderId) => void;
  onChangeModel: (value: string) => void;
  onChangeBaseUrl: (value: string) => void;
  onChangeLanguage: (value: SummaryLanguage) => void;
  onChangeKey: (value: string) => void;
  onToggleKeyVisible: () => void;
  onBlurKey: () => void;
  onClearKey: () => void;
  onChangeSaveKey: (value: boolean) => void;
  onTestConnection: () => void;
};

export type SettingsPanelProps = {
  theme: ThemePreference;
  onChangeTheme: (value: ThemePreference) => void;
  ai: AiPanelProps;
  wordsPerMinute: number;
  onChangeWordsPerMinute: (value: number) => void;
  autoOpenPdf: boolean;
  autoOpenSupported: boolean;
  onToggleAutoOpen: (enabled: boolean) => void;
  documentName: string | null;
  onDeleteDocument: () => void;
  onDeleteAll: () => void;
};

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: vi.themeSystem },
  { value: 'light', label: vi.themeLight },
  { value: 'dark', label: vi.themeDark },
];

export function SettingsPanel({
  theme,
  onChangeTheme,
  ai,
  wordsPerMinute,
  onChangeWordsPerMinute,
  autoOpenPdf,
  autoOpenSupported,
  onToggleAutoOpen,
  documentName,
  onDeleteDocument,
  onDeleteAll,
}: SettingsPanelProps) {
  const aiDisabled = !ai.supported;
  const providerId = ai.settings.providerId;

  return (
    <div class="settings-panel">
      <section class="settings-card">
        <h3 class="settings-card__title">{vi.themeTitle}</h3>
        <div class="settings-options" role="radiogroup" aria-label={vi.themeTitle}>
          {THEME_OPTIONS.map((option) => (
            <label class="settings-radio" key={option.value}>
              <input
                type="radio"
                name="readfocus-theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => onChangeTheme(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{vi.aiTitle}</h3>
        <p class="settings-card__hint">{vi.aiHint}</p>

        <label class="settings-field settings-field--stack">
          <span>{vi.aiProviderLabel}</span>
          <select
            value={providerId}
            disabled={aiDisabled}
            onChange={(event) => ai.onChangeProvider(event.currentTarget.value as ProviderId)}
          >
            {PROVIDERS.map((id) => (
              <option value={id} key={id}>
                {vi.aiProviders[id]}
              </option>
            ))}
          </select>
        </label>

        <label class="settings-field settings-field--stack">
          <span>{vi.aiModelLabel}</span>
          <input
            type="text"
            value={ai.settings.model}
            disabled={aiDisabled}
            spellcheck={false}
            onInput={(event) => ai.onChangeModel(event.currentTarget.value)}
          />
        </label>
        <p class="settings-card__hint">{vi.aiModelHint}</p>

        {providerId === 'openai-compatible' && (
          <>
            <label class="settings-field settings-field--stack">
              <span>{vi.aiBaseUrlLabel}</span>
              <input
                type="url"
                value={ai.settings.baseUrl}
                disabled={aiDisabled}
                spellcheck={false}
                placeholder={vi.aiBaseUrlHint}
                onInput={(event) => ai.onChangeBaseUrl(event.currentTarget.value)}
              />
            </label>
            <p class="settings-card__hint">{vi.aiBaseUrlHint}</p>
          </>
        )}

        <label class="settings-field settings-field--stack">
          <span>{vi.aiKeyLabel}</span>
          <span class="settings-key">
            {ai.keyVisible ? (
              <input
                type="text"
                value={ai.apiKey}
                disabled={aiDisabled}
                autocomplete="off"
                spellcheck={false}
                placeholder={vi.aiKeyPlaceholder}
                onInput={(event) => ai.onChangeKey(event.currentTarget.value)}
                onBlur={ai.onBlurKey}
              />
            ) : (
              <input
                type="password"
                value={ai.apiKey}
                disabled={aiDisabled}
                autocomplete="off"
                spellcheck={false}
                placeholder={vi.aiKeyPlaceholder}
                onInput={(event) => ai.onChangeKey(event.currentTarget.value)}
                onBlur={ai.onBlurKey}
              />
            )}
            <button
              type="button"
              class="settings-icon-button"
              aria-pressed={ai.keyVisible}
              disabled={aiDisabled}
              onClick={ai.onToggleKeyVisible}
            >
              {ai.keyVisible ? vi.aiHideKey : vi.aiShowKey}
            </button>
          </span>
        </label>
        <p class="settings-card__hint">{vi.aiKeyHint}</p>
        <button
          type="button"
          class="settings-button"
          disabled={aiDisabled || ai.apiKey === ''}
          onClick={ai.onClearKey}
        >
          {vi.aiClearKey}
        </button>

        <label class="settings-switch">
          <input
            type="checkbox"
            role="switch"
            checked={ai.settings.saveKey}
            disabled={aiDisabled}
            onChange={(event) => ai.onChangeSaveKey(event.currentTarget.checked)}
          />
          <span>{vi.aiSaveKey}</span>
        </label>
        <p class="settings-card__hint">{vi.aiSaveKeyHint}</p>

        <div class="settings-options" role="radiogroup" aria-label={vi.aiLanguageLabel}>
          <span class="settings-radio-label">{vi.aiLanguageLabel}</span>
          <label class="settings-radio">
            <input
              type="radio"
              name="readfocus-ai-language"
              checked={ai.settings.language === 'vi'}
              disabled={aiDisabled}
              onChange={() => ai.onChangeLanguage('vi')}
            />
            <span>{vi.aiLanguageVi}</span>
          </label>
          <label class="settings-radio">
            <input
              type="radio"
              name="readfocus-ai-language"
              checked={ai.settings.language === 'document'}
              disabled={aiDisabled}
              onChange={() => ai.onChangeLanguage('document')}
            />
            <span>{vi.aiLanguageDocument}</span>
          </label>
        </div>

        <div class="settings-actions">
          <button
            type="button"
            class="settings-button"
            disabled={aiDisabled || ai.busy}
            onClick={ai.onTestConnection}
          >
            {ai.busy ? vi.aiTesting : vi.aiTestConnection}
          </button>
        </div>

        {ai.notice !== null && (
          <p
            class={`settings-notice settings-notice--${ai.notice.tone}`}
            role="status"
            aria-live="polite"
          >
            {ai.notice.message}
          </p>
        )}
        {aiDisabled && <p class="settings-card__hint">{vi.aiUnsupported}</p>}
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{vi.readingSpeedTitle}</h3>
        <label class="settings-field">
          <span>{vi.readingSpeedLabel}</span>
          <input
            type="number"
            min={50}
            max={1000}
            step={10}
            value={wordsPerMinute}
            onInput={(event) => {
              const value = Number(event.currentTarget.value);
              if (Number.isFinite(value) && value > 0) onChangeWordsPerMinute(value);
            }}
          />
        </label>
        <p class="settings-card__hint">{vi.readingSpeedHint}</p>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{vi.autoOpenPdfTitle}</h3>
        <label class="settings-switch">
          <input
            type="checkbox"
            role="switch"
            checked={autoOpenPdf}
            disabled={!autoOpenSupported}
            onChange={(event) => onToggleAutoOpen(event.currentTarget.checked)}
          />
          <span>{vi.autoOpenPdfToggle}</span>
        </label>
        <p class="settings-card__hint">{vi.autoOpenPdfHint}</p>
        <p class="settings-card__hint">{vi.autoOpenPdfFileHint}</p>
        {!autoOpenSupported && <p class="settings-card__hint">{vi.autoOpenPdfUnsupported}</p>}
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{vi.dataTitle}</h3>
        <p class="settings-card__hint">{vi.dataHint}</p>
        {documentName !== null && (
          <button type="button" class="settings-button" onClick={onDeleteDocument}>
            {vi.deleteDocument(documentName)}
          </button>
        )}
        <button type="button" class="settings-button settings-button--danger" onClick={onDeleteAll}>
          {vi.deleteAll}
        </button>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{vi.shortcutsTitle}</h3>
        <dl class="settings-shortcuts">
          {vi.shortcuts.map((shortcut) => (
            <div class="settings-shortcuts__row" key={shortcut.keys}>
              <dt>
                <kbd>{shortcut.keys}</kbd>
              </dt>
              <dd>{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
