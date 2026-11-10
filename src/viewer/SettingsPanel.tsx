import { vi } from '../i18n/vi';

export type SettingsPanelProps = {
  autoOpenPdf: boolean;
  autoOpenSupported: boolean;
  onToggleAutoOpen: (enabled: boolean) => void;
};

export function SettingsPanel({
  autoOpenPdf,
  autoOpenSupported,
  onToggleAutoOpen,
}: SettingsPanelProps) {
  return (
    <div class="settings-panel">
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
    </div>
  );
}
