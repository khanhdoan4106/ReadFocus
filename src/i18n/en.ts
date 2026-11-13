import type { Messages } from './vi';

/**
 * English UI text. The shape comes from `vi.ts`, so a missing key or a function with a
 * different signature fails the type check.
 */
export const en: Messages = {
  appName: 'ReadFocus',

  openFile: 'Open PDF',
  chooseFile: 'Choose a PDF',
  dropHint: 'Drag and drop a PDF here',
  dropActive: 'Drop the file to open it',

  loading: 'Opening document…',
  emptyTitle: 'No document open',
  emptyHint: 'Choose a PDF file or drag it into this window.',

  previousPage: 'Previous page',
  nextPage: 'Next page',
  pageInputLabel: 'Page number',
  pageLabel: (page: number, total: number) => `Page ${page} / ${total}`,

  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomFitWidth: 'Fit width',
  zoomLabel: (percent: number) => `${percent}%`,

  errorTitle: "Can't open this document",
  errorNotPdf: 'This file is not a PDF.',
  errorTooLarge: (limitMb: number) => `This file is larger than ${limitMb} MB and can't be opened.`,
  errorPassword: "This PDF is password-protected. Password-protected files aren't supported yet.",
  errorInvalid: 'The PDF is damaged or can’t be read.',
  errorGeneric: 'Something went wrong while opening the file. Try again or choose another file.',
  errorFetch:
    'Couldn’t download the PDF from this address. The site may block downloads or require you to sign in; download the file to your computer and open it with “Open PDF”.',
  errorFileUrl:
    'Chrome doesn’t let extensions read file:// addresses directly. Open the file with “Open PDF” or drag it into the window. To open it by address, turn on “Allow access to file URLs” for ReadFocus in chrome://extensions.',
  retry: 'Choose another file',

  fileNameUnknown: 'Untitled document',

  profileBook: 'Book',
  profilePaper: 'Paper',
  profileSlides: 'Slides',
  profileUnknown: 'Unknown type',

  extracting: (done: number, total: number) => `Extracting text… ${done}/${total} pages`,
  extractFailed: "Couldn't extract text from this document.",
  scannedWarning:
    'This document is a scan with no text layer, so there is no table of contents, search or summary yet. Run OCR below; you can still read the PDF and use focus mode as usual.',
  ocrHint:
    'OCR runs on your computer and nothing is sent anywhere. Recognized text can be wrong, especially on blurry pages or small print.',
  ocrStart: 'Recognize text (OCR)',
  ocrCancel: 'Cancel',
  ocrRunning: (done: number, total: number) => `Recognizing… ${done}/${total} pages`,
  ocrRangeInvalid: 'Invalid page range. Enter a start page that is not after the end page.',
  ocrRangeOutOfBounds: (pageCount: number) =>
    `The page range must be within 1–${pageCount}. Fix it and try again.`,
  ocrRangeTooLong: (max: number) =>
    `OCR handles at most ${max} pages at a time. Choose a shorter range and run the rest later.`,
  ocrNothingToDo: 'These pages already have text, so OCR isn’t needed.',
  ocrCancelled: 'Cancelled. Pages recognized before that are kept.',
  ocrDone: (count: number) =>
    `Recognized ${count} ${count === 1 ? 'page' : 'pages'}. The table of contents and search are up to date.`,
  ocrFailedPages: (pages: string) =>
    `Couldn’t recognize page ${pages}. Run it again with a smaller page range.`,
  ocrLowConfidence: (pages: string) =>
    `Low confidence on page ${pages}: the text may contain many errors. Compare it with the original page.`,
  ocrReviewNote:
    'Text on recognized pages comes from OCR and may be wrong; those pages carry an “OCR” label in the corner.',
  ocrEngineError:
    'Couldn’t start the text recognition engine. Reload the ReadFocus tab and try again; if it still fails, click Reload for the extension at chrome://extensions.',
  ocrPageBadge: 'OCR',
  ocrPageBadgeTitle: 'The text on this page was recognized by OCR and may be wrong.',
  ocrPageBadgeLowTitle:
    'The text on this page was recognized by OCR with low confidence and may be very wrong.',
  longDocWarning: (limit: number) =>
    `This document is longer than ${limit} pages. Choose the page range to index — viewing the PDF has no limit.`,
  indexFrom: 'From page',
  indexTo: 'To page',
  indexStart: 'Build index',
  indexRangeInvalid: 'Invalid page range.',
  indexRangeTooLong: (limit: number) => `You can index at most ${limit} pages at a time.`,

  sidebarLabel: 'Sidebar',
  tocTitle: 'Contents',
  tocEmpty: 'This document has no table of contents yet.',
  tocBuilding: 'Building the table of contents…',
  tocPageRange: (start: number, end: number) =>
    start === end ? `Page ${start}` : `Pages ${start}–${end}`,

  readingSectionLabel: 'Left in this section',
  readingTotalLabel: 'Left in the document',
  readingMinutes: (minutes: number) => `${minutes} min`,

  searchTab: 'Search',
  searchPlaceholder: 'Search the document',
  searchIgnoreDiacritics: 'Ignore accents',
  searchHint: 'Type a keyword to search the indexed pages.',
  searchNotReady: 'Preparing the search index…',
  searchNoResults: (query: string) => `No results for “${query}”.`,
  searchResultCount: (count: number) => `${count} ${count === 1 ? 'result' : 'results'}`,
  searchSubmit: 'Search',
  semanticToggle: 'By meaning',
  semanticToggleHint: (provider: string) =>
    `Each search sends the text you type to ${provider} to match by meaning.`,
  semanticUnsupported:
    'The current provider has no embeddings API. Choose OpenAI, Gemini or OpenAI-compatible in Settings → AI.',
  semanticMissingKey: 'Enter an API key in Settings → AI to search by meaning.',
  semanticEmpty:
    'There is no text to index yet. Wait for ReadFocus to finish indexing or run OCR first.',
  semanticNoIndex: 'This document has no semantic index yet, so search uses keywords.',
  semanticPartialIndex: (pending: number) =>
    `The semantic index is missing ${pending} ${pending === 1 ? 'passage' : 'passages'} (the document gained text). Rebuild it for full coverage.`,
  semanticBuild: 'Build semantic index',
  semanticBuildMore: 'Update index',
  semanticBuilding: (done: number, total: number) => `Building index: ${done}/${total} passages`,
  semanticCancel: 'Cancel',
  semanticReady: 'The semantic index is ready. Type what you’re looking for and click Search.',
  semanticSearching: 'Searching…',
  semanticHybridNote: 'Results combine keyword and semantic search, ranked by relevance.',
  semanticConfirmTitle: 'Build a semantic index?',
  semanticConfirmBody: (chunks: number, requests: number, provider: string, model: string) =>
    `ReadFocus will send ${chunks} passages of this document (about ${requests} requests) to ${provider} (model ${model}) to build a semantic index. The index is stored on this computer and deleted along with the document’s data. This may cost money under the provider’s pricing.`,
  semanticConfirmAccept: 'Send and build',
  semanticConfirmCancel: 'Not now',

  contextMenuOpen: 'Open with ReadFocus',

  settingsTab: 'Settings',
  autoOpenPdfTitle: 'Open PDFs with ReadFocus automatically',
  autoOpenPdfToggle: 'Open PDFs automatically',
  autoOpenPdfHint:
    'When on, PDF links on the web open in ReadFocus. This needs access to websites to recognize PDF links, and it doesn’t apply to links without a .pdf ending.',
  autoOpenPdfFileHint:
    'To open PDFs on your computer, turn on “Allow access to file URLs” on the extension’s details page.',
  autoOpenPdfUnsupported: 'This only works when ReadFocus is installed in Chrome.',
  autoOpenPermissionDenied:
    "Couldn't turn it on: ReadFocus needs access to websites to recognize PDF links.",
  autoOpenEnabled: 'ReadFocus now opens PDFs automatically.',
  autoOpenDisabled: 'Automatic opening is off and website access was revoked.',

  languageTitle: 'Language',
  languageLabel: 'Interface language',
  languageAuto: 'Follow browser',
  languageVi: 'Tiếng Việt',
  languageEn: 'English',

  themeTitle: 'Appearance',
  themeSystem: 'Follow system',
  themeLight: 'Light',
  themeDark: 'Dark',

  aiTitle: 'AI summaries',
  aiHint:
    'AI is optional. ReadFocus only sends content when you click Test connection or Summarize, and sends it straight to the provider you choose — there is no server in between.',
  aiProviderLabel: 'Provider',
  aiProviders: {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic Claude',
    'openai-compatible': 'OpenAI-compatible (Ollama, LM Studio)',
  },
  aiModelLabel: 'Model',
  aiModelHint: 'Type the exact model name your provider supports.',
  aiEmbedModelLabel: 'Embedding model (search by meaning)',
  aiEmbedModelHint:
    'Leave empty to use the default model. If you change it, the old semantic index is no longer used and must be rebuilt.',
  aiEmbedUnsupported: 'Anthropic has no embeddings, so search by meaning isn’t available.',
  aiBaseUrlLabel: 'API address',
  aiBaseUrlHint:
    'For example http://localhost:11434/v1 for Ollama or http://localhost:1234/v1 for LM Studio.',
  aiKeyLabel: 'API key',
  aiKeyPlaceholder: 'Paste your key here',
  aiShowKey: 'Show key',
  aiHideKey: 'Hide key',
  aiClearKey: 'Remove key',
  aiKeyHint: 'The key is stored unencrypted on this computer and isn’t synced to your account.',
  aiKeySaveFailed: "Couldn't save the key. Check the extension's storage permission and try again.",
  aiSaveKey: 'Keep the key on this computer',
  aiSaveKeyHint: 'Turn off to keep the key only until you close the browser.',
  aiLanguageLabel: 'AI output language',
  aiLanguageVi: 'Vietnamese',
  aiLanguageEn: 'English',
  aiLanguageDocument: 'Same as the document',
  aiLanguageUi: 'Same as the interface',
  aiTestConnection: 'Test connection',
  aiTesting: 'Testing the connection…',
  aiTestOk: 'Connected.',
  aiMissingKey: 'Enter an API key first.',
  aiPermissionDenied:
    "Access to the AI provider hasn't been granted, so the request wasn't sent. Try again and click Allow.",
  aiUnsupported: 'AI features only work when ReadFocus is installed in Chrome.',
  aiCorsHint:
    'If you use Ollama or LM Studio, check that the service is running and allows the extension’s origin (the OLLAMA_ORIGINS environment variable).',
  aiConsentTitle: 'Send content to the provider?',
  aiConsentBody: (provider: string) =>
    `When you summarize, ask questions or test the connection, the content you choose is sent to ${provider} and handled under their own policy. ReadFocus has no server in between and sends no other data.`,
  aiConsentAccept: 'Agree and continue',
  aiConsentCancel: 'Not now',

  flashTab: 'Flashcards',
  flashNoDoc: 'Open a document to create flashcards.',
  flashSummaryTitle: (total: number, due: number) =>
    total === 0
      ? 'No flashcards yet'
      : `${total} ${total === 1 ? 'card' : 'cards'}, ${due} due today`,
  flashBoxesLabel: 'Cards per box',
  flashBox: (box: number) => `Box ${box}`,
  flashStartReview: (due: number) => `Review (${due} ${due === 1 ? 'card' : 'cards'})`,
  flashNothingDue: 'No cards are due today. Come back tomorrow.',
  flashFromSummaries: 'Create cards from summaries',
  flashFromSummariesHint:
    'Takes terms and key points from this document’s existing summaries without calling AI. Creating them again adds no duplicates and keeps your review progress.',
  flashWithAi: 'Create more with AI',
  flashCancel: 'Cancel',
  flashGenerating: 'Creating cards…',
  flashAiHint: (section: string) =>
    `Sends the text of “${section}” to the AI provider to create up to 20 cards (one request).`,
  flashAiNoSection:
    'No section is being read. Wait for ReadFocus to finish indexing and try again.',
  flashAiNotConfigured: 'To create cards with AI, set up a provider and API key in Settings → AI.',
  flashCreated: (count: number) => `Created ${count} new ${count === 1 ? 'card' : 'cards'}.`,
  flashNoNewCards: 'There are no new cards to add.',
  flashNoSummaries:
    'This document has no summaries yet. Summarize a section in the Summary tab first.',
  flashExport: 'Export CSV for Anki',
  flashExportHint:
    'Each row has the front, the back and a tag (document name, page). In Anki choose File → Import.',
  flashShowList: (count: number) => `Show list (${count})`,
  flashHideList: 'Hide list',
  flashClear: 'Delete all cards',
  flashDelete: 'Delete',
  flashOpenPage: (page: number) => `Go to page ${page}`,
  flashProgress: (left: number) => `${left} ${left === 1 ? 'card' : 'cards'} left in this session`,
  flashFront: 'Front',
  flashBackSide: 'Back',
  flashReveal: 'Show answer',
  flashRemembered: 'Got it',
  flashForgot: 'Missed it',
  flashStop: 'Stop reviewing',
  flashSessionDone: 'Done for today.',
  flashBack: 'Back',

  askTab: 'Ask',
  askPlaceholder: 'Ask about this document',
  askSubmit: 'Ask',
  askCancel: 'Cancel',
  askAsking: 'Looking for an answer…',
  askNoDoc: 'Open a document to ask questions.',
  askNotConfiguredHint: 'To ask questions, open Settings → AI and set up a provider and API key.',
  askNoText:
    'There is no document text to answer from yet. Wait for ReadFocus to finish indexing or run OCR first.',
  askScopeNote: (semantic: boolean) =>
    semantic
      ? 'Finds relevant passages by meaning and keywords in the indexed pages.'
      : 'Finds relevant passages by keywords in the indexed pages. Build a semantic index in the Search tab for better results.',
  askSendNote: (provider: string) =>
    `Each question sends the question and a few relevant passages of the document to ${provider}.`,
  askNoContext:
    'No passage related to the question was found in the indexed pages. Try rephrasing it or use keywords that appear in the document.',
  askNotFound: 'The document doesn’t contain this information.',
  askUnverified:
    'Some citations couldn’t be verified and were hidden, or the answer has no citations. Check the original page.',
  askCitationsTitle: 'Citations',
  askCitationOpen: (page: number) => `Go to page ${page}`,
  askRetry: 'Ask again',
  askCopy: 'Copy',
  askCopied: 'Copied',
  askDelete: 'Delete',
  askClearHistory: 'Clear question history',
  askHistoryEmpty: 'No questions yet for this document.',
  askQuestionLabel: 'Question',
  askAnswerLabel: 'Answer',
  askModelInfo: (provider: string, model: string) => `${provider} · ${model}`,

  summaryTab: 'Summary',
  summaryBadgeTitle: 'This section has a summary',
  summaryNotConfiguredTitle: 'AI isn’t set up',
  summaryNotConfiguredHint:
    'To use summaries, open Settings → AI and set up a provider and API key.',
  summaryOpenSettings: 'Open Settings → AI',
  summaryNoDoc: 'Open a document to summarize it.',
  summaryNoToc:
    'There is no table of contents yet. Wait for ReadFocus to finish indexing, or index the pages you want to summarize.',
  summaryCurrentSectionTitle: (title: string) => `Section: ${title}`,
  summarySectionRange: (start: number, end: number) =>
    start === end ? `Page ${start}` : `Pages ${start}–${end}`,
  summarizeCurrentSection: 'Summarize this section',
  summarizeAllSections: 'Summarize everything',
  summarizeAllConfirmTitle: 'Summarize the whole document?',
  summarizeAllConfirmBody: (
    sections: number,
    alreadyDone: number,
    requests: number,
    tokens: number,
  ) =>
    `This will summarize ${sections} indexed ${sections === 1 ? 'section' : 'sections'}${alreadyDone > 0 ? ` (skipping ${alreadyDone} that already ${alreadyDone === 1 ? 'has a summary' : 'have summaries'})` : ''}. Estimate: ${requests} ${requests === 1 ? 'request' : 'requests'}, at least about ${tokens.toLocaleString('en-US')} input tokens. The content of these sections will be sent to the provider you chose. Continue?`,
  summarizeAllNoText:
    'No section has enough text to summarize yet. Index the pages you want to summarize; scanned pages have no text and can’t be summarized.',
  summarizeAllNothingToDo: 'Every indexed section already has a summary.',
  summarizeAllFailed: (count: number) =>
    `${count} ${count === 1 ? 'section' : 'sections'} couldn’t be summarized (the answer was cut off or unreadable). Try again, or change the model in Settings → AI.`,
  summarizeAllRetryFailed: 'Retry failed sections',
  summarizeAllConfirmAccept: 'Start summarizing',
  summarizeAllConfirmCancel: 'Cancel',
  summarizeAllProgress: (done: number, total: number) => `Summarizing… ${done}/${total} sections`,
  summarizeSectionProgress: (done: number, total: number) => `Summarizing… step ${done}/${total}`,
  summarizeRegenerate: 'Regenerate',
  summarizeCopy: 'Copy',
  summarizeCopied: 'Copied to the clipboard',
  summarizeCancel: 'Cancel',
  summarizeCancelling: 'Cancelling…',
  summarizeFromCache: 'From cache',
  summarizeNoText: 'This section has no text (it may be a scan), so it can’t be summarized.',
  summaryKeyPointsTitle: 'Key points',
  summaryTermsTitle: 'Terms',
  summaryPageRef: (page: number) => `Page ${page}`,
  summaryModelInfo: (provider: string, model: string) => `${provider} · ${model}`,
  summaryRetry: 'Try again',

  readingSpeedTitle: 'Reading speed',
  readingSpeedLabel: 'Words per minute',
  readingSpeedHint:
    'Used to estimate reading time. The default is 200 words per minute; ReadFocus keeps adjusting it to your actual pace.',

  dataTitle: 'Saved data',
  dataHint: 'Progress, tables of contents and search indexes stay on this computer only.',
  deleteDocument: (name: string) => `Delete data for “${name}”`,
  deleteDocumentConfirm: (name: string) =>
    `Delete the saved data for “${name}”? The PDF file on your computer isn’t affected.`,
  deleteAll: 'Delete all reading data',
  deleteAllConfirm:
    'Delete all reading data on this computer? Progress, tables of contents, search indexes and statistics will be lost; settings are kept.',
  deleteDocumentDone: 'Deleted the document’s data.',
  deleteAllDone: 'Deleted all reading data.',
  deleteFailed: "Couldn't delete the data. Try again later.",
  shortcutsTitle: 'Keyboard shortcuts',
  shortcuts: [
    { keys: '/', label: 'Search' },
    { keys: 'F', label: 'Turn focus mode on or off' },
    { keys: 'T', label: 'Hide or show the sidebar' },
    { keys: '← →', label: 'Previous page, next page' },
    { keys: 'Space', label: 'Start or pause the timer' },
    { keys: 'Esc', label: 'Leave focus mode' },
  ],

  focusTab: 'Focus',
  chapterTimerTitle: 'Read by chapter',
  chapterTimerHint: 'Counts down the estimated time of the section you’re reading.',
  chapterTimerStart: 'Read this chapter',
  chapterTimerUnavailable: 'A table of contents is needed to estimate a chapter’s time.',
  pomodoroTitle: 'Pomodoro',
  pomodoroHint: 'Split your reading into sessions with breaks in between.',
  pomodoroStart: 'Start a focus session',
  focusMinutesLabel: 'Focus minutes',
  breakMinutesLabel: 'Break minutes',
  timerStatusRunning: 'Running',
  timerStatusPaused: 'Paused',
  timerStatusFinished: 'Time’s up',
  timerPause: 'Pause',
  timerResume: 'Resume',
  timerStop: 'Stop',
  timerModeChapter: 'Chapter',
  timerModeFocus: 'Focus',
  timerModeBreak: 'Break',
  timerToggleAria: (label: string, time: string) => `${label}, ${time} left`,

  focusModeTitle: 'Focus mode',
  focusModeHint: 'Dims the page and keeps a bright band around the line you’re reading.',
  focusModeOn: 'Turn on focus mode',
  focusModeOff: 'Leave focus mode',
  focusBandLabel: 'Band height',
  focusBandValue: (pixels: number) => `${pixels} px`,
  focusMoveHint: 'Move the mouse or press ↑ ↓ to move the band. Press Esc to leave.',
  focusFullscreen: 'Full screen',
  focusExitFullscreen: 'Exit full screen',
  focusFullscreenFailed: "The browser won't enter full screen right now.",

  statsTitle: 'Reading stats',
  statsToday: 'Today',
  statsRecent: 'Last 7 days',
  statsSummary: (minutes: number, pages: number) =>
    `${minutes} min · ${pages} ${pages === 1 ? 'page' : 'pages'}`,
  statsEmpty: 'No reading data yet.',

  notifyChapterTitle: 'Chapter time is up',
  notifyChapterBody: 'You’ve read for the estimated time of this section.',
  notifyFocusTitle: 'Focus session finished',
  notifyFocusBody: 'Take a short break. Your break has started.',
  notifyBreakTitle: 'Break is over',
  notifyBreakBody: 'Back to the next focus session.',
  toastDismiss: 'Dismiss',

  aiErrorMessages: {
    'invalid-key':
      'The key is invalid or isn’t allowed to use this model. Check it in Settings → AI.',
    'model-not-found': 'This model wasn’t found. Check the model name in Settings → AI.',
    'rate-limit': 'The provider is rate-limiting requests. Wait a moment and try again.',
    quota: 'The account is out of quota. Check your balance or limits on the provider’s dashboard.',
    'context-too-long':
      'This part is too long for the model’s limit. Choose a model with a larger input limit in Settings → AI.',
    network: "Couldn't reach the provider. Check your connection and try again.",
    cancelled: 'Cancelled.',
    'bad-response':
      'The provider returned data that couldn’t be read. Try again; if it keeps failing, choose another model in Settings → AI.',
    truncated:
      'The answer was cut off at the output limit. Try again or choose another model in Settings → AI.',
    unknown:
      'Something went wrong calling the provider. Try again; if it keeps failing, check the API address and model in Settings → AI.',
  },
};
