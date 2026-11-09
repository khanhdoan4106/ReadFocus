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
} as const;

export type Messages = typeof vi;
