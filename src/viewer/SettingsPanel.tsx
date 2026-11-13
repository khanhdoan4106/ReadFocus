import { EMBED_DEFAULT_MODELS } from '../core/embed/models';
import type { AiSettings, SummaryLanguage } from '../core/llm/settings';
import { PROVIDERS } from '../core/llm/settings';
import type { ProviderId } from '../core/llm/types';
import type { ThemePreference } from '../core/theme';
import { t, type LanguagePreference } from '../i18n';

export type AiPanelProps = {
  settings: AiSettings;
  apiKey: string;
  keyVisible: boolean;
  supported: boolean;
  busy: boolean;
  notice: { tone: 'ok' | 'error'; message: string } | null;
  onChangeProvider: (providerId: ProviderId) => void;
  onChangeModel: (value: string) => void;
  onChangeEmbedModel: (value: string) => void;
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
  language: LanguagePreference;
  onChangeLanguage: (value: LanguagePreference) => void;
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

function languageOptions(): ReadonlyArray<{ value: LanguagePreference; label: string }> {
  return [
    { value: 'auto', label: t.languageAuto },
    { value: 'vi', label: t.languageVi },
    { value: 'en', label: t.languageEn },
  ];
}

function aiLanguageOptions(): ReadonlyArray<{ value: SummaryLanguage; label: string }> {
  return [
    { value: 'ui', label: t.aiLanguageUi },
    { value: 'vi', label: t.aiLanguageVi },
    { value: 'en', label: t.aiLanguageEn },
    { value: 'document', label: t.aiLanguageDocument },
  ];
}

function themeOptions(): ReadonlyArray<{ value: ThemePreference; label: string }> {
  return [
    { value: 'system', label: t.themeSystem },
    { value: 'light', label: t.themeLight },
    { value: 'dark', label: t.themeDark },
  ];
}

export function SettingsPanel({
  language,
  onChangeLanguage,
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
        <h3 class="settings-card__title">{t.languageTitle}</h3>
        <div class="settings-options" role="radiogroup" aria-label={t.languageLabel}>
          {languageOptions().map((option) => (
            <label class="settings-radio" key={option.value}>
              <input
                type="radio"
                name="readfocus-language"
                value={option.value}
                checked={language === option.value}
                onChange={() => onChangeLanguage(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{t.themeTitle}</h3>
        <div class="settings-options" role="radiogroup" aria-label={t.themeTitle}>
          {themeOptions().map((option) => (
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
        <h3 class="settings-card__title">{t.aiTitle}</h3>
        <p class="settings-card__hint">{t.aiHint}</p>

        <label class="settings-field settings-field--stack">
          <span>{t.aiProviderLabel}</span>
          <select
            value={providerId}
            disabled={aiDisabled}
            onChange={(event) => ai.onChangeProvider(event.currentTarget.value as ProviderId)}
          >
            {PROVIDERS.map((id) => (
              <option value={id} key={id}>
                {t.aiProviders[id]}
              </option>
            ))}
          </select>
        </label>

        <label class="settings-field settings-field--stack">
          <span>{t.aiModelLabel}</span>
          <input
            type="text"
            value={ai.settings.model}
            disabled={aiDisabled}
            spellcheck={false}
            onInput={(event) => ai.onChangeModel(event.currentTarget.value)}
          />
        </label>
        <p class="settings-card__hint">{t.aiModelHint}</p>

        {providerId === 'anthropic' ? (
          <p class="settings-card__hint">{t.aiEmbedUnsupported}</p>
        ) : (
          <>
            <label class="settings-field settings-field--stack">
              <span>{t.aiEmbedModelLabel}</span>
              <input
                type="text"
                value={ai.settings.embedModel}
                placeholder={EMBED_DEFAULT_MODELS[providerId]}
                disabled={aiDisabled}
                spellcheck={false}
                onInput={(event) => ai.onChangeEmbedModel(event.currentTarget.value)}
              />
            </label>
            <p class="settings-card__hint">{t.aiEmbedModelHint}</p>
          </>
        )}

        {providerId === 'openai-compatible' && (
          <>
            <label class="settings-field settings-field--stack">
              <span>{t.aiBaseUrlLabel}</span>
              <input
                type="url"
                value={ai.settings.baseUrl}
                disabled={aiDisabled}
                spellcheck={false}
                placeholder={t.aiBaseUrlHint}
                onInput={(event) => ai.onChangeBaseUrl(event.currentTarget.value)}
              />
            </label>
            <p class="settings-card__hint">{t.aiBaseUrlHint}</p>
          </>
        )}

        <label class="settings-field settings-field--stack">
          <span>{t.aiKeyLabel}</span>
          <span class="settings-key">
            {ai.keyVisible ? (
              <input
                type="text"
                value={ai.apiKey}
                disabled={aiDisabled}
                autocomplete="off"
                spellcheck={false}
                placeholder={t.aiKeyPlaceholder}
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
                placeholder={t.aiKeyPlaceholder}
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
              {ai.keyVisible ? t.aiHideKey : t.aiShowKey}
            </button>
          </span>
        </label>
        <p class="settings-card__hint">{t.aiKeyHint}</p>
        <button
          type="button"
          class="settings-button"
          disabled={aiDisabled || ai.apiKey === ''}
          onClick={ai.onClearKey}
        >
          {t.aiClearKey}
        </button>

        <label class="settings-switch">
          <input
            type="checkbox"
            role="switch"
            checked={ai.settings.saveKey}
            disabled={aiDisabled}
            onChange={(event) => ai.onChangeSaveKey(event.currentTarget.checked)}
          />
          <span>{t.aiSaveKey}</span>
        </label>
        <p class="settings-card__hint">{t.aiSaveKeyHint}</p>

        <div class="settings-options" role="radiogroup" aria-label={t.aiLanguageLabel}>
          <span class="settings-radio-label">{t.aiLanguageLabel}</span>
          {aiLanguageOptions().map((option) => (
            <label class="settings-radio" key={option.value}>
              <input
                type="radio"
                name="readfocus-ai-language"
                checked={ai.settings.language === option.value}
                disabled={aiDisabled}
                onChange={() => ai.onChangeLanguage(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <div class="settings-actions">
          <button
            type="button"
            class="settings-button"
            disabled={aiDisabled || ai.busy}
            onClick={ai.onTestConnection}
          >
            {ai.busy ? t.aiTesting : t.aiTestConnection}
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
        {aiDisabled && <p class="settings-card__hint">{t.aiUnsupported}</p>}
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{t.readingSpeedTitle}</h3>
        <label class="settings-field">
          <span>{t.readingSpeedLabel}</span>
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
        <p class="settings-card__hint">{t.readingSpeedHint}</p>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{t.autoOpenPdfTitle}</h3>
        <label class="settings-switch">
          <input
            type="checkbox"
            role="switch"
            checked={autoOpenPdf}
            disabled={!autoOpenSupported}
            onChange={(event) => onToggleAutoOpen(event.currentTarget.checked)}
          />
          <span>{t.autoOpenPdfToggle}</span>
        </label>
        <p class="settings-card__hint">{t.autoOpenPdfHint}</p>
        <p class="settings-card__hint">{t.autoOpenPdfFileHint}</p>
        {!autoOpenSupported && <p class="settings-card__hint">{t.autoOpenPdfUnsupported}</p>}
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{t.dataTitle}</h3>
        <p class="settings-card__hint">{t.dataHint}</p>
        {documentName !== null && (
          <button type="button" class="settings-button" onClick={onDeleteDocument}>
            {t.deleteDocument(documentName)}
          </button>
        )}
        <button type="button" class="settings-button settings-button--danger" onClick={onDeleteAll}>
          {t.deleteAll}
        </button>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">{t.shortcutsTitle}</h3>
        <dl class="settings-shortcuts">
          {t.shortcuts.map((shortcut) => (
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
