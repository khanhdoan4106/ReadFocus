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

  toolbarLabel: 'Điều khiển tài liệu',
  fileNameUnknown: 'Tài liệu không tên',

  profileBook: 'Sách',
  profilePaper: 'Bài báo',
  profileSlides: 'Slide',
  profileUnknown: 'Chưa rõ loại',

  extracting: (done: number, total: number) => `Đang trích văn bản… ${done}/${total} trang`,
  extractFailed: 'Không trích được văn bản của tài liệu này.',
  scannedWarning:
    'Tài liệu này là bản scan, chưa có lớp chữ nên chưa có mục lục, tìm kiếm hay tóm tắt. Hãy nhận dạng chữ (OCR) bên dưới; bạn vẫn xem PDF và dùng chế độ tập trung bình thường.',
  ocrHint:
    'Nhận dạng chữ chạy ngay trên máy bạn, không gửi gì ra ngoài. Chữ nhận dạng có thể sai, nhất là với trang mờ hoặc chữ nhỏ.',
  ocrStart: 'Nhận dạng chữ (OCR)',
  ocrCancel: 'Huỷ',
  ocrRunning: (done: number, total: number) => `Đang nhận dạng… ${done}/${total} trang`,
  ocrRangeInvalid:
    'Khoảng trang không hợp lệ. Nhập số trang bắt đầu nhỏ hơn hoặc bằng số trang kết thúc.',
  ocrRangeOutOfBounds: (pageCount: number) =>
    `Khoảng trang phải nằm trong 1–${pageCount}. Sửa lại rồi thử lại.`,
  ocrRangeTooLong: (max: number) =>
    `Mỗi lần chỉ nhận dạng tối đa ${max} trang. Chọn khoảng ngắn hơn rồi chạy tiếp phần còn lại sau.`,
  ocrNothingToDo: 'Các trang này đã có chữ, không cần nhận dạng.',
  ocrCancelled: 'Đã huỷ. Các trang nhận dạng xong trước đó vẫn được giữ lại.',
  ocrDone: (count: number) => `Đã nhận dạng ${count} trang. Mục lục và tìm kiếm đã được cập nhật.`,
  ocrFailedPages: (pages: string) =>
    `Không nhận dạng được trang ${pages}. Chạy lại với khoảng trang nhỏ hơn.`,
  ocrLowConfidence: (pages: string) =>
    `Độ tin cậy thấp ở trang ${pages}: chữ có thể sai nhiều. Hãy đối chiếu với trang gốc.`,
  ocrReviewNote:
    'Chữ trên các trang đã nhận dạng là kết quả OCR nên có thể sai; những trang đó có nhãn “OCR” ở góc.',
  ocrEngineError:
    'Không chạy được bộ nhận dạng chữ. Tải lại tab ReadFocus rồi thử lại; nếu vẫn lỗi, bấm Tải lại extension ở chrome://extensions.',
  ocrPageBadge: 'OCR',
  ocrPageBadgeTitle: 'Chữ trên trang này do OCR nhận dạng, có thể sai.',
  ocrPageBadgeLowTitle:
    'Chữ trên trang này do OCR nhận dạng với độ tin cậy thấp, có thể sai nhiều.',
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
  searchSubmit: 'Tìm',
  semanticToggle: 'Theo ý nghĩa',
  semanticToggleHint: (provider: string) =>
    `Mỗi lần tìm sẽ gửi câu bạn gõ tới ${provider} để so khớp theo ý nghĩa.`,
  semanticToggleHintLocal: 'Câu bạn gõ được so khớp ngay trên máy, không gửi đi đâu.',
  semanticModelMissing:
    'Cần tải model chạy trên máy trước. Mở Cài đặt → AI → Nguồn embedding để tải.',
  semanticUnsupported:
    'Nhà cung cấp hiện tại không có API embeddings. Chọn OpenAI, Gemini hoặc OpenAI-compatible, hoặc chọn nguồn “Trên máy”, trong Cài đặt → AI.',
  semanticMissingKey: 'Nhập API key trong Cài đặt → AI để tìm theo ý nghĩa.',
  semanticEmpty:
    'Chưa có chữ nào để tạo chỉ mục. Đợi ReadFocus lập chỉ mục xong hoặc nhận dạng chữ (OCR) trước.',
  semanticNoIndex: 'Tài liệu này chưa có chỉ mục theo ý nghĩa nên đang tìm theo từ khoá.',
  semanticPartialIndex: (pending: number) =>
    `Chỉ mục theo ý nghĩa còn thiếu ${pending} đoạn (do tài liệu có thêm chữ). Tạo lại để tìm đủ.`,
  semanticBuild: 'Tạo chỉ mục theo ý nghĩa',
  semanticBuildMore: 'Bổ sung chỉ mục',
  semanticBuilding: (done: number, total: number) => `Đang tạo chỉ mục: ${done}/${total} đoạn`,
  semanticCancel: 'Huỷ',
  semanticReady: 'Chỉ mục theo ý nghĩa đã sẵn sàng. Nhập câu cần tìm rồi bấm Tìm.',
  semanticSearching: 'Đang tìm…',
  semanticHybridNote: 'Kết quả kết hợp tìm theo từ khoá và theo ý nghĩa, xếp theo mức liên quan.',
  semanticConfirmTitle: 'Tạo chỉ mục theo ý nghĩa?',
  semanticConfirmBody: (chunks: number, requests: number, provider: string, model: string) =>
    `ReadFocus sẽ gửi ${chunks} đoạn văn của tài liệu (khoảng ${requests} request) tới ${provider} (model ${model}) để tạo chỉ mục theo ý nghĩa. Chỉ mục được lưu trên máy này và xoá cùng dữ liệu tài liệu. Việc này có thể tốn phí theo bảng giá của nhà cung cấp.`,
  semanticConfirmAccept: 'Gửi và tạo chỉ mục',
  semanticConfirmBodyLocal: (chunks: number) =>
    `ReadFocus sẽ tạo chỉ mục theo ý nghĩa cho ${chunks} đoạn văn ngay trên máy này bằng model đã tải; không có gì được gửi đi. Việc này có thể mất vài phút và làm máy nóng lên. Chỉ mục được lưu trên máy và xoá cùng dữ liệu tài liệu.`,
  semanticConfirmAcceptLocal: 'Tạo chỉ mục',
  semanticConfirmCancel: 'Để sau',

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

  languageTitle: 'Ngôn ngữ',
  languageLabel: 'Ngôn ngữ giao diện',
  languageAuto: 'Theo trình duyệt',
  languageVi: 'Tiếng Việt',
  languageEn: 'English',

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
  aiEmbedModelLabel: 'Model embedding (tìm theo ý nghĩa)',
  aiEmbedModelHint:
    'Để trống để dùng model mặc định. Đổi model thì chỉ mục theo ý nghĩa cũ không dùng nữa và cần tạo lại.',
  aiEmbedUnsupported: 'Anthropic không có embeddings nên không dùng được tìm theo ý nghĩa.',
  aiEmbedSourceLabel: 'Nguồn embedding',
  aiEmbedSourceProvider: 'Nhà cung cấp AI',
  aiEmbedSourceLocal: 'Trên máy',
  aiEmbedSourceHint:
    'Trên máy: tải một model nhỏ về một lần; sau đó tìm theo ý nghĩa và hỏi đáp không gửi nội dung tài liệu đi đâu và dùng được khi không có mạng. Dùng được cả khi nhà cung cấp là Anthropic.',
  localModelName: 'Model trên máy',
  localModelChecking: 'Đang kiểm tra model…',
  localModelUnsupported: 'Trình duyệt này không hỗ trợ chạy model trên máy.',
  localModelAbsent: (size: string) => `Chưa tải model (${size}).`,
  localModelReady: 'Model đã tải, dùng được khi không có mạng.',
  localModelDownload: (size: string) => `Tải model (${size})`,
  localModelDownloading: (loaded: string, total: string) => `Đang tải: ${loaded} / ${total}`,
  localModelCancel: 'Huỷ tải',
  localModelDelete: 'Xoá model',
  localModelConfirmTitle: 'Tải model chạy trên máy?',
  localModelConfirmBody: (size: string, name: string) =>
    `ReadFocus sẽ tải ${size} từ Hugging Face (huggingface.co) một lần: model ${name} (giấy phép MIT) và bộ tách từ của nó. Hugging Face chỉ nhận yêu cầu tải file và địa chỉ IP của bạn; nội dung tài liệu không được gửi đi. Model lưu trong bộ nhớ của trình duyệt, dùng được khi không có mạng và xoá được trong Cài đặt → AI. Nếu mạng có giới hạn dung lượng, nên tải khi dùng Wi-Fi.`,
  localModelConfirmAccept: (size: string) => `Tải ${size}`,
  localModelConfirmCancel: 'Để sau',
  localModelCancelled: 'Đã huỷ tải. Model chưa được lưu.',
  localModelNotDownloaded: 'Model chưa được tải. Mở Cài đặt → AI để tải.',
  localModelDownloadFailed:
    'Không tải được model. Kiểm tra kết nối mạng rồi thử lại; nếu mạng chặn huggingface.co thì không tải được.',
  localModelRunFailed:
    'Model trên máy gặp lỗi khi chạy. Tải lại tab ReadFocus rồi thử lại; nếu vẫn lỗi, xoá model và tải lại.',
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
  aiLanguageEn: 'Tiếng Anh',
  aiLanguageDocument: 'Theo ngôn ngữ tài liệu',
  aiLanguageUi: 'Theo ngôn ngữ giao diện',
  aiTestConnection: 'Kiểm tra kết nối',
  aiTesting: 'Đang kiểm tra kết nối…',
  aiTestOk: 'Kết nối thành công.',
  aiMissingKey: 'Nhập API key trước.',
  aiPermissionDenied:
    'Chưa cấp quyền truy cập tới nhà cung cấp AI nên chưa gọi được. Thử lại và bấm Cho phép.',
  aiUnsupported: 'Phần AI chỉ hoạt động khi ReadFocus được cài trong Chrome.',
  aiCorsHint:
    'Nếu dùng Ollama hoặc LM Studio, kiểm tra dịch vụ đang chạy và đã cho phép origin của extension (biến môi trường OLLAMA_ORIGINS) chưa.',
  aiConsentTitle: 'Gửi nội dung tới nhà cung cấp?',
  aiConsentBody: (provider: string) =>
    `Khi tóm tắt, hỏi đáp hoặc kiểm tra kết nối, phần nội dung bạn chọn sẽ được gửi tới ${provider} và xử lý theo chính sách riêng của họ. ReadFocus không có máy chủ trung gian và không gửi dữ liệu nào khác.`,
  aiConsentAccept: 'Đồng ý và tiếp tục',
  aiConsentCancel: 'Để sau',

  flashTab: 'Thẻ ôn tập',
  flashNoDoc: 'Chưa mở tài liệu nào để tạo thẻ.',
  flashSummaryTitle: (total: number, due: number) =>
    total === 0 ? 'Chưa có thẻ nào' : `${total} thẻ, ${due} thẻ đến hạn hôm nay`,
  flashBoxesLabel: 'Số thẻ theo hộp',
  flashBox: (box: number) => `Hộp ${box}`,
  flashStartReview: (due: number) => `Ôn tập (${due} thẻ)`,
  flashNothingDue: 'Hôm nay không còn thẻ nào đến hạn. Quay lại vào ngày mai.',
  flashFromSummaries: 'Tạo thẻ từ các bản tóm tắt',
  flashFromSummariesHint:
    'Lấy thuật ngữ và ý chính từ các tóm tắt đã có của tài liệu này, không gọi AI. Tạo lại không làm trùng thẻ và không mất tiến độ ôn.',
  flashWithAi: 'Tạo thêm bằng AI',
  flashCancel: 'Huỷ',
  flashGenerating: 'Đang tạo thẻ…',
  flashAiHint: (section: string) =>
    `Gửi văn bản của mục “${section}” tới nhà cung cấp AI để tạo tối đa 20 thẻ (một request).`,
  flashAiNoSection: 'Chưa có mục đang đọc. Đợi ReadFocus lập chỉ mục xong rồi thử lại.',
  flashAiNotConfigured:
    'Để tạo thẻ bằng AI, hãy thiết lập nhà cung cấp và API key trong Cài đặt → AI.',
  flashCreated: (count: number) => `Đã tạo ${count} thẻ mới.`,
  flashNoNewCards: 'Không có thẻ mới nào để thêm.',
  flashNoSummaries: 'Tài liệu này chưa có bản tóm tắt nào. Tóm tắt một mục ở tab Tóm tắt trước.',
  flashExport: 'Xuất CSV cho Anki',
  flashExportHint:
    'Mỗi dòng gồm mặt trước, mặt sau và nhãn (tên tài liệu, trang). Trong Anki chọn File → Import.',
  flashShowList: (count: number) => `Xem danh sách (${count})`,
  flashHideList: 'Ẩn danh sách',
  flashClear: 'Xoá tất cả thẻ',
  flashDelete: 'Xoá',
  flashOpenPage: (page: number) => `Mở trang ${page}`,
  flashProgress: (left: number) => `Còn ${left} thẻ trong lượt ôn này`,
  flashFront: 'Mặt trước',
  flashBackSide: 'Mặt sau',
  flashReveal: 'Hiện đáp án',
  flashRemembered: 'Nhớ',
  flashForgot: 'Chưa nhớ',
  flashStop: 'Dừng ôn',
  flashSessionDone: 'Xong lượt ôn hôm nay.',
  flashBack: 'Quay lại',

  askTab: 'Hỏi đáp',
  askPlaceholder: 'Hỏi về nội dung tài liệu này',
  askSubmit: 'Hỏi',
  askCancel: 'Huỷ',
  askAsking: 'Đang tìm câu trả lời…',
  askNoDoc: 'Chưa mở tài liệu nào để hỏi.',
  askNotConfiguredHint:
    'Để hỏi đáp, hãy mở tab Cài đặt → AI và thiết lập nhà cung cấp cùng API key.',
  askNoText:
    'Chưa có chữ nào của tài liệu để tìm câu trả lời. Đợi ReadFocus lập chỉ mục xong hoặc nhận dạng chữ (OCR) trước.',
  askScopeNote: (semantic: boolean): string =>
    semantic
      ? 'Tìm đoạn liên quan theo ý nghĩa và từ khoá trong các trang đã lập chỉ mục.'
      : 'Tìm đoạn liên quan theo từ khoá trong các trang đã lập chỉ mục. Tạo chỉ mục theo ý nghĩa ở tab Tìm kiếm để kết quả tốt hơn.',
  askSendNote: (provider: string) =>
    `Mỗi câu hỏi gửi câu hỏi và vài đoạn liên quan của tài liệu tới ${provider}.`,
  askNoContext:
    'Không tìm thấy đoạn nào liên quan tới câu hỏi trong các trang đã lập chỉ mục. Thử diễn đạt khác hoặc dùng từ khoá có trong tài liệu.',
  askNotFound: 'Tài liệu không có thông tin này.',
  askUnverified:
    'Một số trích dẫn không kiểm chứng được nên đã bị ẩn, hoặc câu trả lời không kèm trích dẫn nào. Hãy đối chiếu với trang gốc.',
  askCitationsTitle: 'Trích dẫn',
  askCitationOpen: (page: number) => `Mở trang ${page}`,
  askRetry: 'Hỏi lại',
  askCopy: 'Sao chép',
  askCopied: 'Đã sao chép',
  askDelete: 'Xoá',
  askClearHistory: 'Xoá lịch sử hỏi đáp',
  askHistoryEmpty: 'Chưa có câu hỏi nào cho tài liệu này.',
  askQuestionLabel: 'Câu hỏi',
  askAnswerLabel: 'Trả lời',
  askModelInfo: (provider: string, model: string) => `${provider} · ${model}`,

  summaryTab: 'Tóm tắt',
  summaryBadgeTitle: 'Mục này đã có tóm tắt',
  summaryNotConfiguredTitle: 'Chưa cấu hình AI',
  summaryNotConfiguredHint:
    'Để dùng tính năng tóm tắt, hãy mở tab Cài đặt → AI và thiết lập nhà cung cấp cùng API key.',
  summaryOpenSettings: 'Mở Cài đặt → AI',
  summaryNoDoc: 'Chưa mở tài liệu nào để tóm tắt.',
  summaryNoToc:
    'Chưa có mục lục. Đợi ReadFocus lập chỉ mục xong, hoặc lập chỉ mục các trang cần tóm tắt.',
  summaryCurrentSectionTitle: (title: string) => `Mục: ${title}`,
  summarySectionRange: (start: number, end: number) =>
    start === end ? `Trang ${start}` : `Trang ${start}–${end}`,
  summarizeCurrentSection: 'Tóm tắt mục này',
  summarizeAllSections: 'Tóm tắt toàn bộ',
  summarizeAllConfirmTitle: 'Tóm tắt toàn bộ tài liệu?',
  summarizeAllConfirmBody: (
    sections: number,
    alreadyDone: number,
    requests: number,
    tokens: number,
  ) =>
    `Sẽ tóm tắt ${sections} mục đã lập chỉ mục${alreadyDone > 0 ? ` (bỏ qua ${alreadyDone} mục đã có tóm tắt)` : ''}. Ước lượng: ${requests} request, tối thiểu khoảng ${tokens.toLocaleString('vi-VN')} token đầu vào. Nội dung các mục này sẽ được gửi tới nhà cung cấp bạn đã chọn. Tiếp tục?`,
  summarizeAllNoText:
    'Chưa có mục nào đủ văn bản để tóm tắt. Hãy lập chỉ mục các trang cần tóm tắt; bản scan không có chữ nên không tóm tắt được.',
  summarizeAllNothingToDo: 'Mọi mục đã lập chỉ mục đều đã có tóm tắt.',
  summarizeAllFailed: (count: number) =>
    `${count} mục chưa tóm tắt được (câu trả lời bị cắt hoặc không đọc được). Thử lại, hoặc đổi model trong Cài đặt → AI.`,
  summarizeAllRetryFailed: 'Thử lại các mục lỗi',
  summarizeAllConfirmAccept: 'Bắt đầu tóm tắt',
  summarizeAllConfirmCancel: 'Huỷ bỏ',
  summarizeAllProgress: (done: number, total: number) => `Đang tóm tắt… ${done}/${total} mục`,
  summarizeSectionProgress: (done: number, total: number) => `Đang tóm tắt… bước ${done}/${total}`,
  summarizeRegenerate: 'Tạo lại',
  summarizeCopy: 'Sao chép',
  summarizeCopied: 'Đã sao chép vào bộ nhớ tạm',
  summarizeCancel: 'Huỷ',
  summarizeCancelling: 'Đang huỷ…',
  summarizeFromCache: 'Lấy từ cache',
  summarizeNoText: 'Mục này không có văn bản (có thể là bản scan) nên không tóm tắt được.',
  summaryKeyPointsTitle: 'Ý chính',
  summaryTermsTitle: 'Thuật ngữ',
  summaryPageRef: (page: number) => `Trang ${page}`,
  summaryModelInfo: (provider: string, model: string) => `${provider} · ${model}`,
  summaryRetry: 'Thử lại',

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
    'context-too-long':
      'Phần này quá dài so với giới hạn của model. Chọn model có giới hạn đầu vào lớn hơn trong Cài đặt → AI.',
    network: 'Không kết nối được tới nhà cung cấp. Kiểm tra mạng rồi thử lại.',
    cancelled: 'Đã huỷ.',
    'bad-response':
      'Nhà cung cấp trả về dữ liệu không đọc được. Thử lại; nếu vẫn lỗi, chọn model khác trong Cài đặt → AI.',
    truncated:
      'Câu trả lời bị cắt vì vượt giới hạn đầu ra. Thử lại hoặc chọn model khác trong Cài đặt → AI.',
    unknown:
      'Có lỗi khi gọi nhà cung cấp. Thử lại; nếu vẫn lỗi, kiểm tra địa chỉ API và model trong Cài đặt → AI.',
  } satisfies Record<LLMErrorKind, string>,
};

export type Messages = typeof vi;
