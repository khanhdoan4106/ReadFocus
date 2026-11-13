import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getProvider } from '../../core/llm';
import { DEFAULT_MODELS, resolveModel } from '../../core/llm/models';
import { providerOriginPattern } from '../../core/llm/permissions';
import {
  aiConfigProblem,
  defaultAiSettings,
  type AiSettings,
  type SummaryLanguage,
} from '../../core/llm/settings';
import type { ProviderId } from '../../core/llm/types';
import { getLocale, t } from '../../i18n';
import {
  clearApiKey,
  keyScopeFor,
  loadAiSettings,
  loadApiKey,
  saveAiSettings,
  saveApiKey,
} from '../../storage/ai';
import { aiErrorMessage } from '../ai-errors';

export function useAiSettings() {
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);
  const [aiKey, setAiKey] = useState('');
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const [aiConsentOpen, setAiConsentOpen] = useState(false);
  const aiSupported =
    typeof chrome !== 'undefined' &&
    chrome.permissions !== undefined &&
    chrome.storage?.local !== undefined;
  const aiReadyRef = useRef(false);
  const pendingConsentRef = useRef<(() => void) | null>(null);

  // Nạp tuỳ chọn AI và key đã lưu. Key không bao giờ đi qua log hay thông báo.
  useEffect(() => {
    const local = typeof chrome === 'undefined' ? undefined : chrome.storage?.local;
    if (!local) return;
    void loadAiSettings(local)
      .then(async (settings) => {
        setAiSettings(settings);
        const store = settings.saveKey ? local : chrome.storage?.session;
        if (store) setAiKey(await loadApiKey(store));
        aiReadyRef.current = true;
      })
      .catch(() => {
        aiReadyRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!aiReadyRef.current) return;
    const local = typeof chrome === 'undefined' ? undefined : chrome.storage?.local;
    if (!local) return;
    void saveAiSettings(local, aiSettings);
  }, [aiSettings]);

  const handleAiProvider = useCallback((providerId: ProviderId) => {
    setAiSettings((current) => ({
      ...current,
      providerId,
      model: DEFAULT_MODELS[providerId],
      embedModel: '',
    }));
    setAiNotice(null);
  }, []);

  const handleAiModel = useCallback((value: string) => {
    setAiSettings((current) => ({ ...current, model: value }));
  }, []);

  const handleAiEmbedModel = useCallback((value: string) => {
    setAiSettings((current) => ({ ...current, embedModel: value }));
  }, []);

  const handleAiBaseUrl = useCallback((value: string) => {
    setAiSettings((current) => ({ ...current, baseUrl: value }));
  }, []);

  const handleAiLanguage = useCallback((language: SummaryLanguage) => {
    setAiSettings((current) => ({ ...current, language }));
  }, []);

  const handleAiKey = useCallback((value: string) => {
    setAiKey(value);
    setAiNotice(null);
  }, []);

  const handleAiKeyVisible = useCallback(() => {
    setAiKeyVisible((visible) => !visible);
  }, []);

  // Chỉ ghi key khi rời ô nhập, tránh ghi storage theo từng ký tự.
  const handleAiKeyBlur = useCallback(() => {
    const local = typeof chrome === 'undefined' ? undefined : chrome.storage?.local;
    const store = aiSettings.saveKey ? local : chrome.storage?.session;
    if (!local || !store) return;
    void (aiKey.trim() === ''
      ? clearApiKey(store)
      : saveApiKey(store, aiKey).catch(() =>
          setAiNotice({ tone: 'error', message: t.aiKeySaveFailed }),
        ));
  }, [aiKey, aiSettings.saveKey]);

  const handleAiClearKey = useCallback(() => {
    const local = typeof chrome === 'undefined' ? undefined : chrome.storage?.local;
    const store = aiSettings.saveKey ? local : chrome.storage?.session;
    setAiKey('');
    setAiNotice(null);
    if (store) void clearApiKey(store);
  }, [aiSettings.saveKey]);

  // Đổi nơi lưu key: xoá ở store cũ rồi ghi sang store mới để không còn bản sao.
  const handleAiSaveKey = useCallback(
    (saveKey: boolean) => {
      setAiSettings((current) => ({ ...current, saveKey }));
      const local = typeof chrome === 'undefined' ? undefined : chrome.storage?.local;
      const session = typeof chrome === 'undefined' ? undefined : chrome.storage?.session;
      const previous = keyScopeFor(!saveKey) === 'local' ? local : session;
      const next = keyScopeFor(saveKey) === 'local' ? local : session;
      if (!previous || !next) return;
      void clearApiKey(previous)
        .then(() => (aiKey.trim() === '' ? undefined : saveApiKey(next, aiKey)))
        .catch(() => setAiNotice({ tone: 'error', message: t.aiKeySaveFailed }));
    },
    [aiKey],
  );

  const runAiConnectionTest = useCallback(async () => {
    if (aiConfigProblem(aiSettings, aiKey) !== null) {
      setAiNotice({ tone: 'error', message: t.aiMissingKey });
      return;
    }
    const chromeApi = typeof chrome === 'undefined' ? null : chrome;
    if (!chromeApi?.permissions?.request) {
      setAiNotice({ tone: 'error', message: t.aiUnsupported });
      return;
    }

    const model = resolveModel(aiSettings.providerId, aiSettings.model);
    setAiBusy(true);
    setAiNotice(null);
    try {
      const origin = providerOriginPattern(aiSettings.providerId, aiSettings.baseUrl);
      const granted = await chromeApi.permissions.request({ origins: [origin] });
      if (!granted) {
        setAiNotice({ tone: 'error', message: t.aiPermissionDenied });
        return;
      }
      await getProvider(aiSettings.providerId).checkConnection(
        { apiKey: aiKey.trim(), baseUrl: aiSettings.baseUrl },
        model,
      );
      setAiNotice({ tone: 'ok', message: t.aiTestOk });
    } catch (error) {
      setAiNotice({ tone: 'error', message: aiErrorMessage(error, aiSettings) });
    } finally {
      setAiBusy(false);
    }
  }, [aiKey, aiSettings]);

  const handleAiTestConnection = useCallback(() => {
    if (aiConfigProblem(aiSettings, aiKey) !== null) {
      setAiNotice({ tone: 'error', message: t.aiMissingKey });
      return;
    }
    if (aiSettings.consentGiven) {
      void runAiConnectionTest();
      return;
    }
    pendingConsentRef.current = () => void runAiConnectionTest();
    setAiConsentOpen(true);
  }, [aiKey, aiSettings, runAiConnectionTest]);

  const handleAiConsentAccept = useCallback(() => {
    setAiSettings((current) => ({ ...current, consentGiven: true }));
    setAiConsentOpen(false);
    const next = pendingConsentRef.current;
    pendingConsentRef.current = null;
    next?.();
  }, []);

  const handleAiConsentCancel = useCallback(() => {
    pendingConsentRef.current = null;
    setAiConsentOpen(false);
  }, []);

  const ensureConsent = useCallback(
    (proceed: () => void) => {
      if (aiSettings.consentGiven) {
        proceed();
        return;
      }
      pendingConsentRef.current = proceed;
      setAiConsentOpen(true);
    },
    [aiSettings.consentGiven],
  );
  const model = resolveModel(aiSettings.providerId, aiSettings.model);
  // "Theo ngôn ngữ giao diện" được đổi thành ngôn ngữ cụ thể khi dùng.
  const effectiveLanguage: Exclude<SummaryLanguage, 'ui'> =
    aiSettings.language === 'ui' ? getLocale() : aiSettings.language;
  const configured = aiSupported && aiConfigProblem(aiSettings, aiKey) === null;

  return {
    settings: aiSettings,
    apiKey: aiKey,
    supported: aiSupported,
    configured,
    effectiveLanguage,
    model,
    notice: aiNotice,
    setNotice: setAiNotice,
    consentOpen: aiConsentOpen,
    ensureConsent,
    acceptConsent: handleAiConsentAccept,
    cancelConsent: handleAiConsentCancel,
    /** Phần dành cho tab Cài đặt → AI. */
    panel: {
      settings: aiSettings,
      apiKey: aiKey,
      keyVisible: aiKeyVisible,
      supported: aiSupported,
      busy: aiBusy,
      notice: aiNotice,
      onChangeProvider: handleAiProvider,
      onChangeModel: handleAiModel,
      onChangeEmbedModel: handleAiEmbedModel,
      onChangeBaseUrl: handleAiBaseUrl,
      onChangeLanguage: handleAiLanguage,
      onChangeKey: handleAiKey,
      onToggleKeyVisible: handleAiKeyVisible,
      onBlurKey: handleAiKeyBlur,
      onClearKey: handleAiClearKey,
      onChangeSaveKey: handleAiSaveKey,
      onTestConnection: handleAiTestConnection,
    },
  };
}

export type AiApi = ReturnType<typeof useAiSettings>;
