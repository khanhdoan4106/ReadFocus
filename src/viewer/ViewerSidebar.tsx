import type { TocItem } from '../storage/db';
import { aiConfigProblem } from '../core/llm/settings';
import { clampBandHeight, clampMinutes } from '../core/focus';
import { t } from '../i18n';
import { Sidebar } from './Sidebar';

import type { useFocusTimer } from './hooks/useFocusTimer';
import type { useReadingStats } from './hooks/useReadingStats';
import type { useSettings } from './hooks/useSettings';
import type { useAiSettings } from './hooks/useAiSettings';
import type { LocalModelApi } from './hooks/useLocalModel';
import type { useSummaries } from './hooks/useSummaries';
import type { useExtraction } from './hooks/useExtraction';
import type { useAsk } from './ask';
import type { useFlashcards } from './flashcards';
import type { useSemanticIndex } from './semantic';

type Props = {
  ready: boolean;
  pageNumber: number;
  docId: string | null;
  fileName: string;
  wordsPerMinute: number;
  chapterMinutes: number;
  currentSection: TocItem | null;
  searchRequest: number;
  extraction: ReturnType<typeof useExtraction>;
  focus: ReturnType<typeof useFocusTimer>;
  stats: ReturnType<typeof useReadingStats>;
  settings: ReturnType<typeof useSettings>;
  ai: ReturnType<typeof useAiSettings>;
  localModel: LocalModelApi;
  summarize: ReturnType<typeof useSummaries>;
  semantic: ReturnType<typeof useSemanticIndex>;
  flashcards: ReturnType<typeof useFlashcards>;
  ask: ReturnType<typeof useAsk>;
  onDeleteDocument: () => void;
  onDeleteAll: () => void;
  onSelectPage: (page: number) => void;
  onSelectCitation: (page: number, quote: string) => void;
  onSelectResult: (page: number, query: string, ignoreDiacritics: boolean) => void;
};

/** Thanh bên: ghép dữ liệu của các hook thành props cho từng tab. */
export function ViewerSidebar({
  ready,
  pageNumber,
  docId,
  fileName,
  wordsPerMinute,
  chapterMinutes,
  currentSection,
  searchRequest,
  extraction,
  focus,
  stats,
  settings,
  ai,
  localModel,
  summarize,
  semantic,
  flashcards,
  ask,
  onDeleteDocument,
  onDeleteAll,
  onSelectPage,
  onSelectCitation,
  onSelectResult,
}: Props) {
  const { toc, searchIndex, analysis, extractedPages } = extraction;
  const {
    timer,
    remainingMs: remainingTimerMs,
    focusMinutes,
    breakMinutes,
    bandHeight,
    fullscreen,
    setFocusMinutes,
    setBreakMinutes,
    setBandHeight,
    startChapterTimer,
    startPomodoroTimer,
    toggleTimer,
    stopTimer,
    toggleFocusMode,
    toggleFullscreen,
  } = focus;
  const aiSettings = ai.settings;
  const aiKey = ai.apiKey;
  const aiSupported = ai.supported;

  return (
    <Sidebar
      toc={toc}
      currentPage={pageNumber}
      building={analysis.phase === 'extracting'}
      index={searchIndex}
      wordsPerMinute={wordsPerMinute}
      focus={{
        timer,
        remainingMs: remainingTimerMs,
        chapterMinutes,
        focusMinutes,
        breakMinutes,
        bandHeight,
        fullscreen,
        statsToday: stats.today,
        statsRecent: stats.recent,
        onStartChapter: startChapterTimer,
        onStartPomodoro: startPomodoroTimer,
        onToggleTimer: toggleTimer,
        onStopTimer: stopTimer,
        onChangeFocusMinutes: (value) => setFocusMinutes(clampMinutes(value)),
        onChangeBreakMinutes: (value) => setBreakMinutes(clampMinutes(value, 1, 60)),
        onChangeBandHeight: (value) => setBandHeight(clampBandHeight(value)),
        onToggleFocusMode: toggleFocusMode,
        onToggleFullscreen: toggleFullscreen,
      }}
      settings={{
        language: settings.language,
        onChangeLanguage: settings.onChangeLanguage,
        theme: settings.theme,
        onChangeTheme: settings.onChangeTheme,
        ai: { ...ai.panel, localModel },
        wordsPerMinute: wordsPerMinute,
        onChangeWordsPerMinute: settings.onChangeWordsPerMinute,
        autoOpenPdf: settings.autoOpenPdf,
        autoOpenSupported: settings.autoOpenSupported,
        onToggleAutoOpen: settings.onToggleAutoOpen,
        documentName: ready && docId !== null ? fileName : null,
        onDeleteDocument: onDeleteDocument,
        onDeleteAll: onDeleteAll,
      }}
      summary={summarize.panel}
      semantic={semantic}
      flashPanel={{
        flashcards,
        hasDocument: docId !== null,
        documentName: fileName,
        canGenerate: currentSection !== null,
        aiConfigured: aiSupported && aiConfigProblem(aiSettings, aiKey) === null,
        sectionLabel: currentSection
          ? currentSection.title ||
            t.summarySectionRange(currentSection.startPage, currentSection.endPage)
          : null,
        onOpenSettings: () => {},
        onSelectPage: onSelectPage,
      }}
      askPanel={{
        ask,
        hasDocument: docId !== null,
        hasText: extractedPages.some((page) => page.text.trim() !== ''),
        configured: ai.configured,
        semanticReady: semantic.state === 'ready',
        providerId: aiSettings.providerId,
        onOpenSettings: () => {},
        onSelectCitation: onSelectCitation,
      }}
      summarizedSpans={summarize.summarizedSpans}
      searchRequest={searchRequest}
      onSelectPage={onSelectPage}
      onSelectResult={onSelectResult}
    />
  );
}
