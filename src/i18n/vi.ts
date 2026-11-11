import type { LLMErrorKind, ProviderId } from '../core/llm/types';

export const vi = {
  appName: 'ReadFocus',

  openFile: 'Mở PDF',
  chooseFile: 'Chọn file PDF',
  dropHint: 'Kéo thả file PDF vào đây',
  dropActive: 'Thả file để mở',

  loading: 'Đang mở tài liệu…',
  emptyTitle: 'Chưa mở tài liệu nào',
  emptyHint: 'Chọn một file PDF hoặc kéo thả vào cửa sổ này.',

  previousPage: 'Trang trước',
  nextPage: 'Trang sau',
  pageInputLabel: 'Số trang',
  pageLabel: (page: number, total: number) => `Trang ${page} / ${total}`,

  zoomIn: 'Phóng to',
  zoomOut: 'Thu nhỏ',
  zoomFitWidth: 'Vừa chiều rộng',
  zoomLabel: (percent: number) => `${percent}%`,

  errorTitle: 'Không mở được tài liệu',
  errorNotPdf: 'File này không phải PDF.',
  errorTooLarge: (limitMb: number) => `File lớn hơn ${limitMb} MB nên chưa mở được.`,
  errorPassword: 'PDF này có mật khẩu. Bản v0 chưa hỗ trợ mở file có mật khẩu.',
  errorInvalid: 'File PDF bị hỏng hoặc không đọc được.',
  errorGeneric: 'Có lỗi khi mở file. Thử lại hoặc chọn file khác.',
  errorFetch:
    'Không tải được PDF từ địa chỉ này. Trang có thể chặn tải xuống hoặc yêu cầu đăng nhập; hãy tải file về máy rồi mở bằng nút “Mở PDF”.',
  errorFileUrl:
    'Chrome không cho extension đọc trực tiếp file://. Hãy mở bằng nút “Mở PDF” hoặc kéo thả file vào cửa sổ. Nếu muốn mở theo địa chỉ, bật “Cho phép truy cập URL tệp” cho ReadFocus trong chrome://extensions.',
  retry: 'Chọn file khác',

  fileNameUnknown: 'Tài liệu không tên',

  profileBook: 'Sách',
  profilePaper: 'Bài báo',
  profileSlides: 'Slide',
  profileUnknown: 'Chưa rõ loại',

  extracting: (done: number, total: number) => `Đang trích văn bản… ${done}/${total} trang`,
  extractFailed: 'Không trích được văn bản của tài liệu này.',
  scannedWarning:
    'Tài liệu này là bản scan, không có lớp chữ. Bản v0 chưa hỗ trợ OCR; bạn vẫn xem PDF và dùng chế độ tập trung bình thường.',
  longDocWarning: (limit: number) =>
    `Tài liệu dài hơn ${limit} trang. Chọn khoảng trang cần lập chỉ mục — việc xem PDF không bị giới hạn.`,
  indexFrom: 'Từ trang',
  indexTo: 'Đến trang',
  indexStart: 'Lập chỉ mục',
  indexRangeInvalid: 'Khoảng trang không hợp lệ.',
  indexRangeTooLong: (limit: number) => `Mỗi lần chỉ lập chỉ mục tối đa ${limit} trang.`,

  sidebarLabel: 'Thanh bên',
  tocTitle: 'Mục lục',
  tocEmpty: 'Chưa có mục lục cho tài liệu này.',
  tocBuilding: 'Đang lập mục lục…',
  tocPageRange: (start: number, end: number) =>
    start === end ? `Trang ${start}` : `Trang ${start}–${end}`,

  readingSectionLabel: 'Còn mục này',
  readingTotalLabel: 'Còn cả tài liệu',
  readingMinutes: (minutes: number) => `${minutes} phút`,

  searchTab: 'Tìm kiếm',
  searchPlaceholder: 'Tìm trong tài liệu',
  searchIgnoreDiacritics: 'Tìm không dấu',
  searchHint: 'Nhập từ khoá để tìm trong các trang đã lập chỉ mục.',
  searchNotReady: 'Đang chuẩn bị chỉ mục tìm kiếm…',
  searchNoResults: (query: string) => `Không tìm thấy “${query}”.`,
  searchResultCount: (count: number) => `${count} kết quả`,

  contextMenuOpen: 'Mở bằng ReadFocus',

  settingsTab: 'Cài đặt',
  autoOpenPdfTitle: 'Tự mở PDF bằng ReadFocus',
  autoOpenPdfToggle: 'Bật tự mở PDF',
  autoOpenPdfHint:
    'Khi bật, link PDF trên web sẽ mở bằng ReadFocus. Cần cấp quyền truy cập trang web để nhận diện link PDF; không áp dụng cho link không có đuôi .pdf.',
  autoOpenPdfFileHint:
    'Muốn mở PDF trên máy, bật “Cho phép truy cập URL tệp” trong trang chi tiết extension.',
  autoOpenPdfUnsupported: 'Tính năng này chỉ hoạt động khi ReadFocus được cài trong Chrome.',
  autoOpenPermissionDenied:
    'Chưa bật được: ReadFocus cần quyền truy cập trang web để nhận diện link PDF.',
  autoOpenEnabled: 'Đã bật tự mở PDF bằng ReadFocus.',
  autoOpenDisabled: 'Đã tắt tự mở PDF và thu hồi quyền truy cập trang web.',

  themeTitle: 'Giao diện',
  themeSystem: 'Theo hệ thống',
  themeLight: 'Sáng',
  themeDark: 'Tối',

  aiTitle: 'Tóm tắt bằng AI',
  aiHint:
    'AI là tuỳ chọn. ReadFocus chỉ gửi nội dung khi bạn bấm Kiểm tra kết nối hoặc Tóm tắt, và gửi thẳng tới nhà cung cấp bạn chọn — không qua máy chủ trung gian.',
  aiProviderLabel: 'Nhà cung cấp',
  aiProviders: {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic Claude',
    'openai-compatible': 'OpenAI-compatible (Ollama, LM Studio)',
  } satisfies Record<ProviderId, string>,
  aiModelLabel: 'Model',
  aiModelHint: 'Gõ đúng tên model mà nhà cung cấp hỗ trợ.',
  aiBaseUrlLabel: 'Địa chỉ API',
  aiBaseUrlHint:
    'Ví dụ http://localhost:11434/v1 cho Ollama hoặc http://localhost:1234/v1 cho LM Studio.',
  aiKeyLabel: 'API key',
  aiKeyPlaceholder: 'Dán key vào đây',
  aiShowKey: 'Hiện key',
  aiHideKey: 'Ẩn key',
  aiClearKey: 'Xoá key',
  aiKeyHint: 'Key được lưu không mã hoá trên máy này, không đồng bộ lên tài khoản.',
  aiKeySaveFailed: 'Không lưu được key. Kiểm tra quyền lưu trữ của extension rồi thử lại.',
  aiSaveKey: 'Lưu key trên máy này',
  aiSaveKeyHint: 'Tắt để chỉ giữ key tới khi đóng trình duyệt.',
  aiLanguageLabel: 'Ngôn ngữ tóm tắt',
  aiLanguageVi: 'Tiếng Việt',
  aiLanguageDocument: 'Theo ngôn ngữ tài liệu',
  aiTestConnection: 'Kiểm tra kết nối',
  aiTesting: 'Đang kiểm tra kết nối…',
  aiTestOk: 'Kết nối thành công.',
  aiMissingKey: 'Nhập API key trước khi kiểm tra kết nối.',
  aiPermissionDenied:
    'Chưa cấp quyền truy cập tới nhà cung cấp nên chưa kiểm tra được. Thử lại và bấm Cho phép.',
  aiUnsupported: 'Phần AI chỉ hoạt động khi ReadFocus được cài trong Chrome.',
  aiCorsHint:
    'Nếu dùng Ollama hoặc LM Studio, kiểm tra dịch vụ đang chạy và đã cho phép origin của extension (biến môi trường OLLAMA_ORIGINS) chưa.',
  aiConsentTitle: 'Gửi nội dung tới nhà cung cấp?',
  aiConsentBody: (provider: string) =>
    `Khi tóm tắt hoặc kiểm tra kết nối, phần nội dung bạn chọn sẽ được gửi tới ${provider} và xử lý theo chính sách riêng của họ. ReadFocus không có máy chủ trung gian và không gửi dữ liệu nào khác.`,
  aiConsentAccept: 'Đồng ý và tiếp tục',
  aiConsentCancel: 'Để sau',

  readingSpeedTitle: 'Tốc độ đọc',
  readingSpeedLabel: 'Từ mỗi phút',
  readingSpeedHint:
    'Dùng để ước tính thời gian đọc. Mặc định 200 từ/phút; ReadFocus vẫn tự điều chỉnh theo nhịp đọc thực tế.',

  dataTitle: 'Dữ liệu đã lưu',
  dataHint: 'Tiến độ, mục lục và chỉ mục tìm kiếm chỉ nằm trên máy này.',
  deleteDocument: (name: string) => `Xoá dữ liệu của “${name}”`,
  deleteDocumentConfirm: (name: string) =>
    `Xoá dữ liệu đã lưu của “${name}”? File PDF trên máy không bị ảnh hưởng.`,
  deleteAll: 'Xoá toàn bộ dữ liệu đọc',
  deleteAllConfirm:
    'Xoá toàn bộ dữ liệu đọc trên máy này? Tiến độ, mục lục, chỉ mục tìm kiếm và thống kê sẽ mất; cài đặt được giữ nguyên.',
  deleteDocumentDone: 'Đã xoá dữ liệu của tài liệu.',
  deleteAllDone: 'Đã xoá toàn bộ dữ liệu đọc.',
  deleteFailed: 'Không xoá được dữ liệu. Thử lại sau.',
  shortcutsTitle: 'Phím tắt',
  shortcuts: [
    { keys: '/', label: 'Tìm kiếm' },
    { keys: 'F', label: 'Bật hoặc tắt chế độ tập trung' },
    { keys: 'T', label: 'Ẩn hoặc hiện thanh bên' },
    { keys: '← →', label: 'Trang trước, trang sau' },
    { keys: 'Space', label: 'Bắt đầu hoặc tạm dừng hẹn giờ' },
    { keys: 'Esc', label: 'Thoát chế độ tập trung' },
  ],

  focusTab: 'Tập trung',
  chapterTimerTitle: 'Đọc theo chương',
  chapterTimerHint: 'Đếm ngược theo thời gian ước tính của mục đang đọc.',
  chapterTimerStart: 'Đọc chương này',
  chapterTimerUnavailable: 'Cần mục lục để ước tính thời gian của chương.',
  pomodoroTitle: 'Pomodoro',
  pomodoroHint: 'Chia việc đọc thành từng phiên, nghỉ giữa các phiên.',
  pomodoroStart: 'Bắt đầu phiên tập trung',
  focusMinutesLabel: 'Phút tập trung',
  breakMinutesLabel: 'Phút nghỉ',
  timerStatusRunning: 'Đang chạy',
  timerStatusPaused: 'Đang tạm dừng',
  timerStatusFinished: 'Đã hết giờ',
  timerPause: 'Tạm dừng',
  timerResume: 'Chạy tiếp',
  timerStop: 'Dừng',
  timerModeChapter: 'Đọc chương',
  timerModeFocus: 'Tập trung',
  timerModeBreak: 'Nghỉ',
  timerToggleAria: (label: string, time: string) => `${label}, còn ${time}`,

  focusModeTitle: 'Chế độ tập trung',
  focusModeHint: 'Làm mờ trang và giữ một dải sáng quanh dòng đang đọc.',
  focusModeOn: 'Bật chế độ tập trung',
  focusModeOff: 'Thoát chế độ tập trung',
  focusBandLabel: 'Chiều cao dải sáng',
  focusBandValue: (pixels: number) => `${pixels} px`,
  focusMoveHint: 'Di chuyển chuột hoặc nhấn ↑ ↓ để đưa dải sáng. Nhấn Esc để thoát.',
  focusFullscreen: 'Toàn màn hình',
  focusExitFullscreen: 'Thoát toàn màn hình',
  focusFullscreenFailed: 'Trình duyệt không cho bật toàn màn hình lúc này.',

  statsTitle: 'Thống kê đọc',
  statsToday: 'Hôm nay',
  statsRecent: '7 ngày qua',
  statsSummary: (minutes: number, pages: number) => `${minutes} phút · ${pages} trang`,
  statsEmpty: 'Chưa có dữ liệu đọc.',

  notifyChapterTitle: 'Hết giờ đọc chương',
  notifyChapterBody: 'Bạn đã đọc đủ thời gian ước tính cho mục này.',
  notifyFocusTitle: 'Hết phiên tập trung',
  notifyFocusBody: 'Nghỉ một chút nhé. Giờ nghỉ đã bắt đầu.',
  notifyBreakTitle: 'Hết giờ nghỉ',
  notifyBreakBody: 'Quay lại phiên tập trung tiếp theo.',
  toastDismiss: 'Đóng',

  aiErrorMessages: {
    'invalid-key':
      'Key không hợp lệ hoặc không có quyền dùng model này. Kiểm tra lại trong Cài đặt → AI.',
    'model-not-found': 'Không tìm thấy model này. Kiểm tra lại tên model trong Cài đặt → AI.',
    'rate-limit': 'Nhà cung cấp đang giới hạn tốc độ. Đợi một lát rồi thử lại.',
    quota:
      'Tài khoản đã hết hạn mức. Kiểm tra số dư hoặc hạn mức trong trang quản lý của nhà cung cấp.',
    'context-too-long': 'Phần này quá dài so với giới hạn của model. Thử tóm tắt mục ngắn hơn.',
    network: 'Không kết nối được tới nhà cung cấp. Kiểm tra mạng rồi thử lại.',
    cancelled: 'Đã huỷ.',
    'bad-response': 'Nhà cung cấp trả về dữ liệu không đọc được. Thử lại giúp mình nhé.',
    truncated:
      'Câu trả lời bị cắt vì vượt giới hạn đầu ra. Thử lại hoặc chọn model khác trong Cài đặt → AI.',
    unknown: 'Có lỗi khi gọi nhà cung cấp. Thử lại sau.',
  } satisfies Record<LLMErrorKind, string>,
} as const;

export type Messages = typeof vi;
