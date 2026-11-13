import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  emptyReadingSpeed,
  sanitizeReadingSpeed,
  speedFromWordsPerMinute,
  wordsPerMinute as learnedWordsPerMinute,
  type ReadingSpeed,
} from '../../core/reading-time';
import { parseThemePreference, THEME_SETTING_KEY, type ThemePreference } from '../../core/theme';
import {
  browserLanguage,
  LANGUAGE_SETTING_KEY,
  mirrorPreference,
  parseLanguagePreference,
  readMirroredPreference,
  resolveLocale,
  setLocale,
  subscribeLocale,
  t,
  type LanguagePreference,
} from '../../i18n';
import { loadSetting, saveSetting } from '../../storage/db';
import { applyTheme, watchSystemTheme } from '../theme';

type Input = {
  /** Hiện một thông báo ngắn trong viewer. */
  showToast: (message: string) => void;
};

export function useSettings({ showToast }: Input) {
  const [speed, setSpeed] = useState<ReadingSpeed>(emptyReadingSpeed);
  const [autoOpenPdf, setAutoOpenPdf] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [language, setLanguage] = useState<LanguagePreference>(readMirroredPreference);
  // Đổi ngôn ngữ thì render lại cả viewer để chữ đổi ngay.
  const [, setLocaleTick] = useState(0);
  useEffect(() => subscribeLocale(() => setLocaleTick((tick) => tick + 1)), []);
  const autoOpenSupported =
    typeof chrome !== 'undefined' &&
    chrome.permissions !== undefined &&
    chrome.storage?.sync !== undefined;
  const speedReadyRef = useRef(false);
  // Nạp tốc độ đọc đã học từ các phiên trước.
  useEffect(() => {
    void loadSetting<unknown>('readingSpeed').then((value) => {
      if (value !== null) setSpeed(sanitizeReadingSpeed(value));
      speedReadyRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!speedReadyRef.current) return;
    void saveSetting('readingSpeed', speed);
  }, [speed]);

  // Nạp giao diện đã chọn; "theo hệ thống" thì đổi màu khi hệ điều hành đổi.
  useEffect(() => {
    void loadSetting<unknown>(THEME_SETTING_KEY).then((value) => {
      setTheme(parseThemePreference(value));
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    return watchSystemTheme((resolved) => {
      document.documentElement.dataset.theme = resolved;
    });
  }, [theme]);

  const handleTheme = useCallback((value: ThemePreference) => {
    setTheme(value);
    applyTheme(value);
    void saveSetting(THEME_SETTING_KEY, value);
  }, []);

  // Nạp ngôn ngữ giao diện đã chọn; "theo trình duyệt" thì tuỳ ngôn ngữ của trình duyệt.
  useEffect(() => {
    void loadSetting<unknown>(LANGUAGE_SETTING_KEY).then((value) => {
      const preference = parseLanguagePreference(value);
      setLanguage(preference);
      mirrorPreference(preference);
      setLocale(resolveLocale(preference, browserLanguage()));
    });
  }, []);

  const handleLanguage = useCallback((value: LanguagePreference) => {
    setLanguage(value);
    mirrorPreference(value);
    setLocale(resolveLocale(value, browserLanguage()));
    void saveSetting(LANGUAGE_SETTING_KEY, value);
  }, []);

  const handleWordsPerMinute = useCallback((value: number) => {
    setSpeed(speedFromWordsPerMinute(value));
  }, []);

  // Đọc trạng thái tự mở PDF và đối chiếu quyền host thực tế.
  useEffect(() => {
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (!chromeApi?.permissions || !chromeApi.storage?.sync) return;

    void Promise.all([
      chromeApi.storage.sync.get('autoOpenPdf'),
      chromeApi.permissions.contains({ origins: ['*://*/*'] }),
    ])
      .then(([stored, granted]) => {
        const wantsEnabled = stored.autoOpenPdf === true;
        setAutoOpenPdf(wantsEnabled && granted);
        if (wantsEnabled && !granted) {
          void chromeApi.storage.sync.set({ autoOpenPdf: false });
          void chromeApi.runtime.sendMessage({ type: 'sync-auto-open-pdf' });
        }
      })
      .catch(() => setAutoOpenPdf(false));
  }, []);

  const handleAutoOpenPdf = useCallback(async (enabled: boolean) => {
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (!chromeApi?.permissions || !chromeApi.storage?.sync) return;

    try {
      if (enabled) {
        // Phải gọi request() ngay trong thao tác bấm của người dùng.
        const granted = await chromeApi.permissions.request({ origins: ['*://*/*'] });
        if (!granted) {
          setAutoOpenPdf(false);
          showToast(t.autoOpenPermissionDenied);
          return;
        }
        await chromeApi.storage.sync.set({ autoOpenPdf: true });
        setAutoOpenPdf(true);
        await chromeApi.runtime.sendMessage({ type: 'sync-auto-open-pdf' });
        showToast(t.autoOpenEnabled);
        return;
      }

      await chromeApi.storage.sync.set({ autoOpenPdf: false });
      setAutoOpenPdf(false);
      await chromeApi.runtime.sendMessage({ type: 'sync-auto-open-pdf' });
      await chromeApi.permissions.remove({ origins: ['*://*/*'] });
      showToast(t.autoOpenDisabled);
    } catch {
      setAutoOpenPdf(false);
      showToast(t.autoOpenPermissionDenied);
    }
  }, []);

  const readingWordsPerMinute = learnedWordsPerMinute(speed);

  return {
    theme,
    setSpeed,
    wordsPerMinute: readingWordsPerMinute,
    autoOpenPdf,
    autoOpenSupported,
    language,
    onChangeLanguage: handleLanguage,
    onChangeTheme: handleTheme,
    onChangeWordsPerMinute: handleWordsPerMinute,
    onToggleAutoOpen: handleAutoOpenPdf,
  };
}
