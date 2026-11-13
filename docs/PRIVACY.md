# Quyền riêng tư

ReadFocus xử lý PDF và mọi dữ liệu đọc ngay trên máy. Mặc định không gửi dữ liệu ra ngoài. Không có analytics, telemetry, quảng cáo hay thư viện tải từ CDN. Ngoại lệ duy nhất là tóm tắt bằng AI: tuỳ chọn và chỉ chạy khi bạn chủ động (xem phần *Tóm tắt bằng AI*).

## Dữ liệu được lưu

Khi bạn mở một tài liệu, ReadFocus lưu vào IndexedDB của extension (cơ sở dữ liệu `readfocus`):

- tên file, kích thước, số trang, thời điểm mở;
- văn bản trích từ từng trang (để tìm kiếm và ước tính thời gian), kể cả chữ do OCR nhận dạng kèm vị trí từng từ;
- mục lục và chỉ mục tìm kiếm;
- trang đang đọc và thời gian đã đọc;
- thống kê số phút, số trang theo ngày;
- cài đặt như giao diện, tốc độ đọc, Pomodoro và chiều cao dải sáng;
- bản tóm tắt AI đã tạo (cache, kèm nhà cung cấp và model đã dùng), nếu bạn từng tóm tắt;
- vector tìm theo ý nghĩa, lịch sử hỏi đáp và thẻ ôn tập (kèm hộp và ngày ôn) của từng tài liệu, nếu bạn từng dùng các tính năng đó.

Ngoài ra:

- **`localStorage`** giữ hai giá trị `readfocus:theme` và `readfocus.uiLanguage` để áp giao diện và ngôn ngữ trước khi viewer render, tránh nháy màu hay đổi chữ.
- **`chrome.storage.sync`** chỉ giữ cờ `autoOpenPdf` (bật/tắt tự mở PDF). Nếu bạn đăng nhập Chrome, cờ này có thể được Chrome đồng bộ theo tài khoản Google của bạn; không có nội dung tài liệu nào được đồng bộ.

Tài liệu gốc không bị sửa và không bị sao chép ra khỏi máy.

## Dữ liệu không được gửi đi

- Không có máy chủ của ReadFocus.
- Không gửi nội dung PDF, văn bản trích, mục lục, từ khoá tìm kiếm hay thống kê đọc tới bất kỳ đâu.
- Không có mã theo dõi, không có mã tải từ xa; mọi thư viện được đóng gói sẵn trong extension.

## PDF mở từ web

Khi bạn chủ động mở một PDF trên web (chuột phải → **Mở bằng ReadFocus**, bấm icon khi đang ở tab PDF, hoặc bật tự mở PDF), extension tải đúng địa chỉ đó về máy để hiển thị. Máy chủ chứa file thấy request giống như khi trình duyệt tải file bình thường, kèm địa chỉ IP của bạn; ReadFocus không gửi thêm thông tin nào khác.

Nếu bật **Tự mở PDF bằng ReadFocus**, Chrome sẽ hỏi quyền truy cập trang web. Quyền này chỉ dùng để nhận diện và chuyển hướng link `.pdf`; ReadFocus không đọc nội dung các trang bạn truy cập và không ghi lại lịch sử duyệt web.

## Quyền của extension

Danh sách đầy đủ và lý do từng quyền nằm ở [`PERMISSIONS.md`](PERMISSIONS.md). Tóm tắt:

- `storage`, `notifications`: lưu dữ liệu cục bộ và báo hết giờ hẹn.
- `contextMenus`, `activeTab`: thêm mục **Mở bằng ReadFocus** và đọc địa chỉ tab khi bạn bấm icon.
- `declarativeNetRequestWithHostAccess`: thêm/gỡ rule chuyển hướng PDF khi bạn bật tính năng tự mở.
- Quyền host `*://*/*` là quyền tuỳ chọn, chỉ được xin khi bạn bật tự mở PDF.
- Quyền host tới địa chỉ API của nhà cung cấp AI cũng là tuỳ chọn, chỉ được xin khi bạn dùng tính năng AI.

## Xoá dữ liệu

Trong tab **Cài đặt** của viewer:

- **Xoá dữ liệu của …** xoá tiến độ, văn bản, mục lục và chỉ mục tìm kiếm của tài liệu đang mở.
- **Xoá toàn bộ dữ liệu đọc** xoá dữ liệu của mọi tài liệu và thống kê; cài đặt giao diện/tốc độ được giữ nguyên.

Gỡ extension khỏi Chrome cũng xoá IndexedDB và `localStorage` của ReadFocus.

## Tóm tắt bằng AI

Tính năng này tắt cho tới khi bạn tự cấu hình trong **Cài đặt → AI**.

**Gửi gì.** Khi bạn bấm **Tóm tắt mục này** hoặc **Tóm tắt toàn bộ**: văn bản đã trích của mục (hoặc các mục) được chọn, kèm tiêu đề mục, loại tài liệu và hướng dẫn tóm tắt. Không gửi file PDF gốc, ảnh trang, tên file, lịch sử đọc hay thống kê. **Kiểm tra kết nối** chỉ gửi một câu hỏi ngắn cố định, không có nội dung tài liệu.

**Gửi cho ai.** Chỉ nhà cung cấp bạn chọn, qua kết nối thẳng từ trình duyệt của bạn, không qua máy chủ của ReadFocus:

- OpenAI (`api.openai.com`), Google Gemini (`generativelanguage.googleapis.com`) hoặc Anthropic (`api.anthropic.com`);
- hoặc địa chỉ OpenAI-compatible bạn nhập. Với Ollama/LM Studio chạy trên máy, dữ liệu không rời khỏi máy; nếu bạn trỏ tới dịch vụ khác thì dữ liệu đi tới dịch vụ đó.

Cách nhà cung cấp lưu hoặc dùng dữ liệu tuỳ theo điều khoản và cài đặt tài khoản của họ; ReadFocus không kiểm soát được phần đó. Hãy cân nhắc trước khi gửi tài liệu nhạy cảm.

**Khi nào.** Lần đầu bạn bấm **Kiểm tra kết nối**, ReadFocus hiện hộp xác nhận việc gửi dữ liệu; chỉ khi bạn đồng ý mới có request được gửi. Chrome cũng xin quyền truy cập đúng địa chỉ API của nhà cung cấp tại thời điểm đó; quyền này là tuỳ chọn và không được xin lúc cài. Sau đó, request chỉ được gửi khi bạn bấm một nút tóm tắt hoặc kiểm tra kết nối. **Tóm tắt toàn bộ** luôn hiện ước lượng số request và token rồi hỏi xác nhận.

**Key lưu ở đâu.** Chỉ trên máy bạn, trong `chrome.storage.local` (mặc định). Nếu tắt **Lưu key trên máy này**, key nằm trong `chrome.storage.session` và mất khi đóng trình duyệt. Key không được đồng bộ qua tài khoản Chrome và chỉ được gửi tới nhà cung cấp bạn chọn (trong header của request). Lưu ý: `chrome.storage.local` không được mã hoá; người dùng khác của máy hoặc phần mềm đọc được hồ sơ Chrome của bạn có thể đọc được key.

**Kết quả.** Bản tóm tắt được lưu trong IndexedDB (store `summaries`) để lần sau không phải gọi lại. Kết quả chỉ hiển thị dạng văn bản thuần; ReadFocus không render HTML và không tự mở link trong đó.

**Cách xoá.**

- **Xoá key** (Cài đặt → AI): xoá key, giữ nhà cung cấp và model.
- **Xoá dữ liệu của …** hoặc **Xoá toàn bộ dữ liệu đọc**: xoá luôn các bản tóm tắt của tài liệu tương ứng.
- Gỡ extension xoá toàn bộ dữ liệu của ReadFocus, gồm key và tóm tắt.
- Thu hồi quyền truy cập nhà cung cấp: `chrome://extensions` → ReadFocus → Chi tiết → Quyền truy cập trang web. Nếu key có thể đã lộ, hãy thu hồi nó ở trang quản lý của nhà cung cấp.

## Tìm theo ý nghĩa và hỏi đáp (v2)

Hai tính năng này dùng cùng nhà cung cấp, key và quyền truy cập như tóm tắt AI, và chỉ chạy khi bạn bấm nút. Anthropic không có API embeddings nên không dùng được nguồn nhà cung cấp cho tìm theo ý nghĩa; bạn vẫn có thể chọn nguồn **Trên máy** (xem phần *Embedding chạy trên máy*).

**Tìm theo ý nghĩa.**

- **Tạo chỉ mục theo ý nghĩa** (tab Tìm kiếm, bật **Theo ý nghĩa**) gửi *toàn bộ văn bản đã trích của tài liệu*, chia thành các đoạn khoảng 300 từ, tới nhà cung cấp để tạo vector. ReadFocus hiện hộp xác nhận ghi số đoạn, số request, nhà cung cấp và model trước khi gửi; việc này có thể tốn phí theo bảng giá của nhà cung cấp.
- Mỗi lần bạn bấm **Tìm** ở chế độ này, câu bạn gõ được gửi tới nhà cung cấp đó để tạo vector so khớp. Gõ vào ô tìm không gửi gì; tìm theo từ khoá vẫn chạy hoàn toàn trên máy.
- Vector lưu trong IndexedDB (store `embeddings`), gắn với nhà cung cấp, model và địa chỉ API đã dùng; đổi model thì chỉ mục cũ không được dùng lại.

**Hỏi đáp.** Mỗi câu hỏi là một request, gửi *câu hỏi và vài đoạn văn liên quan nhất của tài liệu* (kèm số trang). Câu hỏi và câu trả lời được lưu trong IndexedDB (store `qa`) để xem lại; chỉ hiển thị dạng văn bản thuần. Trích dẫn trang chỉ được hiện khi kiểm chứng được với văn bản của trang đó.

**Cách xoá.** Nút **Xoá** và **Xoá lịch sử hỏi đáp** trong tab Hỏi đáp; **Xoá dữ liệu của …** và **Xoá toàn bộ dữ liệu đọc** xoá luôn vector và lịch sử hỏi đáp.

## Nhận dạng chữ (OCR)

OCR chạy hoàn toàn trên máy: thư viện, file WebAssembly và dữ liệu ngôn ngữ (tiếng Việt, tiếng Anh) nằm sẵn trong extension, không tải gì từ mạng và không gửi ảnh trang hay chữ nhận dạng đi đâu. Chữ nhận dạng được lưu cùng văn bản các trang (IndexedDB, store `pages`) và bị xoá cùng dữ liệu tài liệu.

## Thẻ ôn tập

Thẻ tạo từ các bản tóm tắt đã có không gọi mạng. **Tạo thêm bằng AI** gửi văn bản của mục đang đọc tới nhà cung cấp AI (một request), qua hộp đồng ý và quyền truy cập như tóm tắt. Thẻ lưu trong IndexedDB (store `flashcards`), xoá được từng thẻ hoặc tất cả trong tab Thẻ ôn tập, và bị xoá cùng dữ liệu tài liệu. **Xuất CSV** chỉ tạo file tải về trên máy bạn.

## Embedding chạy trên máy (tuỳ chọn)

Ở **Cài đặt → AI → Nguồn embedding**, bạn có thể chọn **Trên máy** thay vì nhà cung cấp AI. Khi đó tìm theo ý nghĩa và hỏi đáp tạo vector ngay trên máy bạn; văn bản tài liệu, câu tìm và câu hỏi không được gửi đi đâu để tạo vector. Nguồn này dùng được cả khi nhà cung cấp là Anthropic.

**Tải model (một lần, chỉ khi bạn đồng ý).** Bấm **Tải model** sẽ hiện hộp xác nhận ghi dung lượng (khoảng 129 MB) và nguồn tải. Chỉ khi bạn bấm **Tải**, ReadFocus tải từ Hugging Face (`huggingface.co`, file lớn được chuyển tiếp sang `*.hf.co`) các file của model `Xenova/multilingual-e5-small` (giấy phép MIT, bản ONNX của `intfloat/multilingual-e5-small`, hỗ trợ tiếng Việt) đã ghim theo mã commit, gồm trọng số và bộ tách từ. Hugging Face chỉ thấy các yêu cầu tải file và địa chỉ IP của bạn, giống khi trình duyệt tải một file bất kỳ; không có nội dung tài liệu nào được gửi. Có thể huỷ giữa chừng; lần tải dở không được lưu.

**Lưu ở đâu, xoá thế nào.** Model nằm trong Cache API của trình duyệt (cache `transformers-cache` của trang extension), lần sau dùng không cần mạng. Nút **Xoá model** trong Cài đặt → AI xoá hết các file này. Vector tạo từ model lưu trong IndexedDB (store `embeddings`) với khoá nguồn riêng, không dùng lẫn với vector của nhà cung cấp, và bị xoá cùng dữ liệu tài liệu. Chạy model dùng Web Worker và runtime ONNX (WebAssembly) nằm sẵn trong extension (`ort/`); không tải thư viện hay code từ mạng.

Sau khi tải, ReadFocus không gọi Hugging Face nữa: chạy model chỉ đọc từ cache và từ chối mọi yêu cầu mạng.

