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
    'Chrome không cho extension đọc trực tiếp file://. Hãy mở bằng nút “Mở PDF” hoặc kéo thả file vào cửa sổ. Nếu muốn mở theo địa chỉ, bật “Allow access to file URLs” cho ReadFocus trong chrome://extensions.',
  retry: 'Chọn file khác',

  fileNameUnknown: 'Tài liệu không tên',

  profileBook: 'Sách',
  profilePaper: 'Bài báo',
  profileSlides: 'Slide',
  profileUnknown: 'Chưa rõ loại',

  extracting: (done: number, total: number) => `Đang trích văn bản… ${done}/${total} trang`,
  extractFailed: 'Không trích được văn bản của tài liệu này.',
  scannedWarning:
    'Tài liệu này là bản scan, không có lớp chữ. Bản v0 chưa hỗ trợ OCR; bạn vẫn xem PDF và dùng chế độ tập trung được.',
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

  focusTab: 'Tập trung',
  chapterTimerTitle: 'Đọc theo chương',
  chapterTimerHint: 'Đếm ngược theo thời gian ước tính của mục đang đọc.',
  chapterTimerStart: 'Đọc chương này',
  chapterTimerUnavailable: 'Cần mục lục để ước tính thời gian của chương.',
  pomodoroTitle: 'Pomodoro',
  pomodoroHint: 'Chia việc đọc thành từng phiên, có giờ nghỉ ở giữa.',
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
} as const;

export type Messages = typeof vi;
