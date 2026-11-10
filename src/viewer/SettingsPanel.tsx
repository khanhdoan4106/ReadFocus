import type { ThemePreference } from '../core/theme';
import { vi } from '../i18n/vi';

export type SettingsPanelProps = {
  theme: ThemePreference;
  onChangeTheme: (value: ThemePreference) => void;
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
  wordsPerMinute,
  onChangeWordsPerMinute,
  autoOpenPdf,
  autoOpenSupported,
  onToggleAutoOpen,
  documentName,
  onDeleteDocument,
  onDeleteAll,
}: SettingsPanelProps) {
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
