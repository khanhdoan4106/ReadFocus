# ReadFocus

Extension Chrome giúp đọc PDF dễ chịu hơn: tự lập mục lục, tìm kiếm trong tài liệu, ước tính thời gian đọc, hẹn giờ theo chương và chế độ tập trung. Phù hợp với sách, bài báo khoa học và slide bài giảng.

> 🚧 Đang phát triển (v0 và v1 đã xong; v2 đã có OCR, tìm theo ý nghĩa, hỏi đáp và thẻ ôn tập, đang chờ thử tay). Kế hoạch chi tiết ở [`docs/PLAN.md`](docs/PLAN.md).

## Tính năng

- **Đọc PDF ngay trong extension**: chọn file, kéo thả hoặc mở PDF từ web. Cuộn liên tục, zoom, nhảy trang; chỉ render những trang đang nhìn thấy nên tài liệu dài vẫn mượt.
- **Mục lục tự động**: lấy bookmark của PDF trước, sau đó đoán tiêu đề theo cỡ chữ và từ khoá, gom slide cùng chủ đề, cuối cùng chia mỗi 10 trang. Bấm một mục để nhảy tới.
- **Tìm kiếm**: tìm theo đoạn, có tuỳ chọn bỏ dấu tiếng Việt (“chuong” khớp “chương”), hiện snippet và tô vàng kết quả trên trang.
- **Ước tính thời gian đọc**: thời gian còn lại của mục đang đọc và của cả tài liệu; tốc độ đọc tự điều chỉnh theo nhịp đọc thực tế, có thể chỉnh tay trong Cài đặt.
- **Tập trung**: hẹn giờ theo chương hoặc Pomodoro 25/5, focus mode làm mờ trang và giữ một dải sáng quanh dòng đang đọc, thống kê phút và số trang theo ngày.
- **Nhận diện tài liệu**: phân loại sách, bài báo, slide; cảnh báo bản scan không có lớp chữ.
- **Tóm tắt bằng AI (tuỳ chọn)**: tóm tắt từng mục hoặc cả tài liệu (tối đa 100 trang), có ý chính kèm số trang bấm được và thuật ngữ. Dùng key của chính bạn; mặc định tắt.
- **Nhận dạng chữ (OCR)**: PDF scan được nhận dạng ngay trên máy (tiếng Việt và tiếng Anh), không gửi gì ra mạng; sau đó mục lục, tìm kiếm và tóm tắt dùng được như PDF thường. Chữ nhận dạng có thể sai nên trang được đánh dấu "OCR".
- **Tìm theo ý nghĩa (tuỳ chọn)**: tìm theo ý chứ không chỉ theo từ khoá, kết hợp với tìm từ khoá. Dùng API embeddings của nhà cung cấp bạn đã cấu hình.
- **Hỏi đáp (tuỳ chọn)**: hỏi về nội dung tài liệu, câu trả lời kèm trích dẫn trang đã được kiểm chứng với văn bản của trang; bấm trích dẫn để nhảy tới trang và tô đoạn.
- **Thẻ ôn tập**: tạo thẻ từ các bản tóm tắt (không gọi AI) hoặc nhờ AI tạo thêm cho một mục, ôn theo 5 hộp Leitner, xuất CSV nhập vào Anki.
- **Cài đặt**: giao diện sáng/tối/theo hệ thống, tốc độ đọc, tự mở PDF trên web, xoá dữ liệu đã lưu.

Giao diện có tiếng Việt và English; chọn ở Cài đặt → Ngôn ngữ (mặc định theo trình duyệt).

## Cài đặt

Cần Node 22 và Chrome có hỗ trợ Manifest V3.

```bash
npm ci
npm run build
```

Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ tới thư mục `dist/`.

Bấm icon ReadFocus trên toolbar để mở viewer. Để mở PDF trên máy theo địa chỉ `file://`, bật **Cho phép truy cập URL tệp** trong trang chi tiết của extension; nếu không, hãy dùng nút **Mở PDF** hoặc kéo thả file.

### PDF trên web

- Chuột phải vào trang hoặc link PDF rồi chọn **Mở bằng ReadFocus**.
- Hoặc bấm icon ReadFocus khi đang ở tab PDF.
- Muốn mọi link `.pdf` tự mở bằng ReadFocus, bật **Tự mở PDF bằng ReadFocus** trong tab Cài đặt. Tính năng này mặc định tắt và chỉ xin quyền truy cập trang web khi bạn bật.

## Tóm tắt bằng AI

Tính năng này **tuỳ chọn** và mặc định tắt; mọi tính năng khác vẫn chạy khi không cấu hình AI. ReadFocus không có máy chủ riêng: bạn tự nhập API key và extension gọi thẳng tới nhà cung cấp bạn chọn.

1. Mở tab **Cài đặt → AI**, chọn nhà cung cấp, nhập key và tên model (có sẵn model mặc định).
2. Bấm **Kiểm tra kết nối**. Lần đầu, ReadFocus hỏi xác nhận việc gửi dữ liệu và Chrome xin quyền truy cập đúng địa chỉ API của nhà cung cấp.
3. Mở tab **Tóm tắt**, bấm **Tóm tắt mục này** hoặc **Tóm tắt toàn bộ** (hiện ước lượng số request và token trước, bạn xác nhận mới chạy).

Kết quả được lưu trên máy nên mở lại file sẽ thấy ngay (nhãn “Lấy từ cache”). Lấy key ở đâu:

| Nhà cung cấp | Lấy key tại |
|---|---|
| OpenAI | <https://platform.openai.com/api-keys> |
| Google Gemini | <https://aistudio.google.com/apikey> |
| Anthropic | <https://console.anthropic.com/settings/keys> |
| OpenAI-compatible | Không cần key nếu chạy cục bộ (Ollama, LM Studio); với dịch vụ khác, dùng key do dịch vụ cấp |

Key mặc định được lưu trong `chrome.storage.local` trên máy này. Tắt **Lưu key trên máy này** để chỉ giữ key đến khi đóng trình duyệt; bấm **Xoá key** để xoá hẳn. Chi tiết ở [`docs/PRIVACY.md`](docs/PRIVACY.md).

### Dùng Ollama (hoặc LM Studio) chạy cục bộ

Dữ liệu không rời khỏi máy bạn.

1. Cài Ollama và tải một model, ví dụ `ollama pull llama3.2`.
2. Cho phép extension gọi Ollama. Mặc định Ollama chỉ chấp nhận request từ `127.0.0.1` và `0.0.0.0`; với extension trình duyệt, theo [FAQ của Ollama](https://docs.ollama.com/faq) bạn phải cho phép origin của extension một cách rõ ràng bằng biến môi trường `OLLAMA_ORIGINS`, ví dụ `chrome-extension://*` (mọi extension Chrome) hoặc đúng origin `chrome-extension://<ID extension>` hiện ở `chrome://extensions`. Thiếu bước này, trình duyệt chặn request (CORS) và ReadFocus báo không kết nối được.
   - **Windows:** thoát Ollama (bấm biểu tượng Ollama ở khay hệ thống rồi chọn Quit) → mở Cài đặt (Windows 11) hoặc Control Panel (Windows 10), tìm "environment variables" và chọn **Edit environment variables for your account** → thêm hoặc sửa biến `OLLAMA_ORIGINS` với giá trị `chrome-extension://*` → bấm OK → mở lại Ollama từ menu Start.
   - macOS và Linux: xem mục đặt biến môi trường trong FAQ trên, rồi khởi động lại Ollama.
3. Trong **Cài đặt → AI** chọn **OpenAI-compatible**, đặt base URL `http://localhost:11434/v1`, nhập tên model, để trống key và bấm **Kiểm tra kết nối**.

LM Studio làm tương tự, với base URL `http://localhost:1234/v1`.

Để tìm theo ý nghĩa với Ollama, tải thêm một model embedding (ví dụ `ollama pull nomic-embed-text`) rồi điền tên đó vào ô **Model embedding** trong Cài đặt → AI. Embeddings đi qua `/v1/embeddings` của Ollama nên dữ liệu vẫn không rời khỏi máy.

## Phát triển

| Lệnh | Việc |
|---|---|
| `npm run dev` | chạy dev, build ra `dist/` để load unpacked |
| `npm run build` | build production ra `dist/` |
| `npm run typecheck` | kiểm tra kiểu TypeScript |
| `npm run lint` | ESLint và kiểm tra Prettier |
| `npm test` | chạy unit test một lần |
| `npm run package` | nén `dist/` thành `release/readfocus-v<version>.zip` |
| `npm run fixtures` | tạo lại các PDF mẫu trong `tests/fixtures/` |
| `npm run fixtures:scan` | tạo lại `scanned-vi.pdf` (bản scan tiếng Việt không có lớp chữ, để thử OCR) |

Các PDF mẫu (`book.pdf`, `paper.pdf`, `slides.pdf`, `scanned.pdf`, `vietnamese.pdf`) do script tự sinh, không chứa nội dung có bản quyền.

Quy trình nhánh, commit và PR: [`docs/WORKFLOW.md`](docs/WORKFLOW.md). Danh sách quyền và lý do: [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).

## Giới hạn

- OCR chạy theo khoảng trang bạn chọn (tối đa 100 trang mỗi lần) và chỉ có tiếng Việt, tiếng Anh. Chữ nhận dạng có thể sai với trang mờ hoặc chữ nhỏ.
- Chỉ lập chỉ mục tối đa 100 trang mỗi lần. Tài liệu dài hơn vẫn xem bình thường; viewer sẽ hỏi khoảng trang cần lập chỉ mục.
- PDF có mật khẩu chưa mở được.
- PDF trên web khác origin có thể bị CORS chặn; khi đó hãy tải file về máy rồi mở bằng nút **Mở PDF**.
- Tóm tắt AI chỉ chạy tối đa 100 trang mỗi lần “Tóm tắt toàn bộ”; chất lượng và chi phí phụ thuộc vào nhà cung cấp bạn chọn. PDF scan không tóm tắt được vì không có văn bản.
- Tìm theo ý nghĩa và hỏi đáp cần key của nhà cung cấp có API embeddings (OpenAI, Gemini, hoặc OpenAI-compatible như Ollama); Anthropic không có embeddings nên không dùng được tìm theo ý nghĩa (hỏi đáp vẫn dùng được, tìm đoạn liên quan theo từ khoá).
- **Embedding chạy hoàn toàn trên máy chưa có (đang hoãn).** Kế hoạch là chạy model đa ngôn ngữ nhỏ bằng `@huggingface/transformers`, nhưng thư viện này còn chứa sẵn chuỗi CDN (`cdn.jsdelivr.net`) trong bundle, trái với quy tắc không tham chiếu CDN của dự án, nên chưa đưa vào. Sẽ làm sau khi có cách xử lý được duyệt; hiện tìm theo ý nghĩa luôn đi qua API.
- Chưa có bản tiếng Anh.

## Quyền riêng tư

Mọi dữ liệu được xử lý và lưu ngay trên máy. Không có analytics, telemetry hay thư viện tải từ CDN. OCR chạy hoàn toàn trên máy. Chỉ khi bạn bật AI và chủ động bấm (tóm tắt, tạo chỉ mục theo ý nghĩa, tìm theo ý nghĩa, hỏi, tạo thẻ bằng AI), phần văn bản liên quan mới được gửi tới nhà cung cấp bạn đã chọn. Chi tiết ở [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Giấy phép

[MIT](LICENSE)
