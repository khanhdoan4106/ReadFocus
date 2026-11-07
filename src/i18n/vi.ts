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
} as const;

export type Messages = typeof vi;
