# PLAN — ReadFocus

> Agent chỉ được thay đổi các quyết định kiến trúc trong file này sau khi hỏi người dùng (xem `AGENTS.md` mục 7). Được phép tách nhỏ task (T2a, T2b, …) và đánh dấu tiến độ.

## Mục tiêu v0

Extension Chrome (Manifest V3) giúp đọc PDF nhanh và tập trung hơn, **không dùng AI và không gửi dữ liệu ra ngoài máy**. Gồm: viewer, mục lục tự động, tìm kiếm, ước tính thời gian đọc, hẹn giờ theo chương, focus mode.

## Stack

- Node 22 (xem `.nvmrc`), npm.
- Vite + TypeScript (`strict`) + Preact.
- `@crxjs/vite-plugin` để build MV3. Nếu plugin này gặp vấn đề, dùng Vite multi-entry và ghi lại quyết định.
- `pdfjs-dist`, worker bundle cục bộ.
- `idb` cho IndexedDB, `minisearch` cho tìm kiếm.
- Vitest, ESLint (flat config), Prettier. License MIT.

## Script npm bắt buộc (CI dựa vào các tên này)

| Script | Việc |
|---|---|
| `npm run dev` | chạy dev, build ra `dist/` để load unpacked |
| `npm run build` | build production ra `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + kiểm tra Prettier |
| `npm test` | Vitest chạy một lần (không watch) |
| `npm run package` | nén `dist/` thành `release/readfocus-v<version>.zip` |

Phiên bản lấy từ `package.json`. `manifest.json` phải có cùng `version` (script `package` kiểm tra và báo lỗi nếu lệch).

## Kiến trúc

- Trang viewer riêng của extension (`viewer.html`) có thanh bên tích hợp gồm các tab: Mục lục, Tìm kiếm, Tập trung, Cài đặt (v1 thêm tab Tóm tắt).
- v0 chưa dùng Chrome Side Panel API, để giữ đơn giản (xem "Để sau").
- Background service worker chỉ lo context menu, nút toolbar và mở viewer.

```
src/
  core/        # logic thuần, có test
  viewer/      # UI viewer + sidebar
  background/
  storage/     # IndexedDB
  i18n/vi.ts
tests/
  fixtures/    # PDF tự tạo bằng script trong scripts/
scripts/       # script phụ: tạo fixture, đóng gói zip
docs/
public/icons/
```

## Đặc tả tính năng

### Mở tài liệu
- Chọn file từ máy, hoặc kéo thả file vào viewer.
- PDF trên web:
  - nút trên toolbar hoặc context menu "Mở bằng ReadFocus" cho tab hay link `.pdf`;
  - viewer tự fetch file và hiển thị;
  - tùy chọn tự động chuyển mọi `.pdf` sang ReadFocus qua `declarativeNetRequest`, **mặc định tắt**.
- File `file://` cần người dùng bật "Allow access to file URLs". Viewer phải hiện hướng dẫn khi phát hiện trường hợp này.

### Định danh và lưu trữ
- Mỗi tài liệu được định danh bằng hash SHA-256 của nội dung file.
- IndexedDB lưu: metadata, văn bản đã trích theo trang, mục lục, chỉ mục tìm kiếm (serialize), tiến độ (trang cuối đang đọc, thời gian đã đọc), thống kê theo ngày, cài đặt.
- Có nút xóa dữ liệu của một tài liệu, và nút xóa toàn bộ dữ liệu (cần xác nhận).

### Trích văn bản và nhận diện loại tài liệu (`src/core/profile.ts`)
- Phân loại `book | paper | slides | unknown` bằng heuristic:
  - `slides`: phần lớn trang nằm ngang, ít chữ mỗi trang;
  - `paper`: có "Abstract"/"Tóm tắt" và "References"/"Tài liệu tham khảo";
  - `book`: có outline nhiều cấp hoặc có "Chương"/"Chapter".
- Người dùng có thể đổi loại bằng tay.
- Phát hiện bản scan: phần lớn trang không có lớp chữ. Khi đó báo rằng v0 chưa hỗ trợ OCR; vẫn xem PDF và dùng phần tập trung được.

### Mục lục (`src/core/toc.ts`) — thử lần lượt
1. Outline/bookmark của PDF.
2. Heuristic tiêu đề: cỡ chữ lớn hơn hẳn chữ thân bài, font đậm, dòng ngắn, và khớp mẫu `Chương|Chapter|Phần|Part|Mục|Bài|\d+(\.\d+)*\s`.
3. Với `slides`: gom các slide liên tiếp có tiêu đề cùng chủ đề.
4. Nếu các bước trên đều không ra kết quả: chia đều mỗi 10 trang.

Mỗi mục có: tiêu đề, trang bắt đầu, trang kết thúc, cấp, số từ. Bấm vào mục để nhảy tới. Mục đang đọc được làm nổi bật.

### Tìm kiếm (`src/core/search.ts`)
- MiniSearch, đánh chỉ mục theo đoạn, mỗi đoạn gắn số trang.
- Tùy chọn tìm không dấu tiếng Việt ("chuong" khớp "chương"; xử lý đúng chữ `đ`).
- Kết quả hiện snippet và số trang. Bấm vào để nhảy tới trang và highlight trong text layer.

### Thời gian đọc (`src/core/reading-time.ts`)
- Đếm số từ của từng mục.
- Tốc độ mặc định 200 từ/phút, chỉnh được.
- Học tốc độ thực tế từ thời gian đọc có hoạt động. Bỏ qua khoảng nghỉ trên 2 phút và lúc tab bị ẩn.
- Hiển thị thời gian còn lại của mục đang đọc và của cả tài liệu.

### Tập trung
- Phiên đọc theo chương: bấm "Đọc chương này" để đếm ngược theo thời gian ước tính.
- Pomodoro, mặc định 25/5 phút, chỉnh được. Thông báo bằng `chrome.notifications` hoặc trong trang.
- Focus mode: làm mờ toàn trang, chỉ chừa một dải sáng quanh dòng đang đọc; dải đi theo chuột hoặc phím ↑/↓, chiều cao chỉnh được. Ẩn thanh bên, có thể bật toàn màn hình.
- Tự tạm dừng khi người dùng không hoạt động hoặc chuyển tab.
- Thống kê: phút đọc và số trang theo ngày.

### Giới hạn
- Lập chỉ mục tối đa 100 trang mỗi lần.
- Tài liệu dài hơn: cảnh báo và cho chọn khoảng trang hoặc chương. Phần xem PDF không bị giới hạn.

### Phím tắt
- `/` tìm kiếm · `F` focus mode · `T` thanh bên · `←`/`→` chuyển trang · `Space` bắt đầu/tạm dừng hẹn giờ.

## Danh sách task

Nhánh và PR theo nhóm: **Nhóm A** (T1–T3) trên `feat/v0-foundation`, **Nhóm B** (T4–T7) trên `feat/v0-reading-core`, **Nhóm C** (T8–T11) trên `feat/v0-focus-polish`. Xong mỗi nhóm thì push và mở PR vào `main`.

- [x] **T1** Scaffold: Vite, TS strict, Preact, crxjs, ESLint/Prettier, Vitest, `manifest.json` MV3 tối thiểu, đủ 6 script ở bảng trên (kể cả `scripts/package.mjs`), icon tạm. CI trong `.github/workflows/ci.yml` phải chạy xanh.
- [x] **T2a** Viewer cơ bản: mở file bằng picker hoặc kéo thả; pdf.js render một trang + text layer; zoom; điều hướng trang; trạng thái lỗi (PDF hỏng, có mật khẩu, quá lớn). Có test cho logic phân trang/zoom.
- [x] **T2b** Viewer cuộn liên tục: virtualize theo vùng nhìn thấy, text layer cho từng trang, theo dõi trang đang đọc, nhảy tới trang.
- [x] **T3** Storage: hash SHA-256, schema IndexedDB, lưu và khôi phục trang cuối đang đọc.
- [x] **T4** Trích văn bản tăng dần + `profile.ts` + phát hiện bản scan + cảnh báo trên 100 trang. Script tạo PDF fixture trong `scripts/`. Có test.
- [x] **T5** `toc.ts`, đủ 4 tầng fallback, có test; UI tab Mục lục.
- [x] **T6** `search.ts` + chuẩn hóa tiếng Việt, có test; UI tab Tìm kiếm + highlight.
- [x] **T7** `reading-time.ts` + học tốc độ đọc, có test; hiển thị thời gian trong mục lục.
- [x] **T8** Tập trung: hẹn giờ theo chương, Pomodoro, focus mode, phát hiện không hoạt động, thống kê.
- [x] **T9** Mở PDF từ web: context menu, nút toolbar, tùy chọn tự chuyển (mặc định tắt), hướng dẫn `file://`; hoàn thiện `docs/PERMISSIONS.md`.
- [x] **T10** Cài đặt, dark mode, phím tắt, các trạng thái lỗi; rà toàn bộ câu chữ tiếng Việt.
- [x] **T11** Hoàn thiện README (tính năng, cài unpacked, build, quyền riêng tư), viết `docs/PRIVACY.md`, kiểm tra `npm run package`, cập nhật mục v1 bên dưới.

## v1 — Tóm tắt bằng AI (BYOK)

> Người dùng tự nhập API key. Không backend, không analytics. Chỉ gửi dữ liệu khi người dùng chủ động bấm tóm tắt hoặc kiểm tra kết nối, và chỉ tới đúng nhà cung cấp đã chọn.

### Nguyên tắc

- Không có backend. Extension gọi thẳng API của nhà cung cấp bằng key của người dùng.
- AI là tuỳ chọn. Chưa cấu hình AI thì mọi tính năng v0 vẫn chạy như cũ; tab Tóm tắt chỉ hiện hướng dẫn cài đặt.
- Gọi API bằng `fetch`, không thêm SDK của nhà cung cấp.
- Nội dung PDF là dữ liệu không tin cậy (có thể chứa prompt injection). Kết quả AI luôn hiển thị dưới dạng text, không dùng `innerHTML`/`dangerouslySetInnerHTML`, không render markdown thành HTML thô; link trong kết quả không tự mở.

### Nhà cung cấp (`src/core/llm/`)

- Interface chung `LLMProvider`: `id`, `label`, `defaultModel`, `complete(request, { signal })` trả về text, tuỳ chọn `stream(...)`. Lỗi chuẩn hoá thành: `invalid-key`, `rate-limit`, `quota`, `context-too-long`, `network`, `cancelled`, `bad-response`, `unknown`.
- Bốn provider: **OpenAI**, **Google Gemini**, **Anthropic Claude**, **OpenAI-compatible** (người dùng nhập base URL, dùng cho Ollama/LM Studio chạy trên máy).
- Tên model gom vào một file hằng số, mỗi provider một model mặc định, người dùng gõ được model bất kỳ. Kiểm tra với tài liệu chính thức hiện tại và ghi nguồn vào `PROGRESS.md`.
- Anthropic gọi từ trình duyệt cần header `anthropic-dangerous-direct-browser-access: true`.
- Ollama cần `OLLAMA_ORIGINS` cho origin `chrome-extension://...`; viewer hiện hướng dẫn khi gặp lỗi CORS với provider này.
- `429`: thử lại tối đa 2 lần với backoff, tôn trọng `Retry-After`. Mọi request huỷ được bằng `AbortController`.

### Quyền

- `optional_host_permissions` thêm đúng: `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.anthropic.com/*`, `http://localhost/*`, `http://127.0.0.1/*` (cùng `*://*/*` của tính năng tự mở PDF). Xin quyền lúc người dùng chọn provider, không xin lúc cài.
- Base URL tuỳ chỉnh khác localhost: xin quyền đúng origin tại thời điểm dùng. Quyền rộng hơn danh sách này phải dừng lại hỏi người dùng.
- Cập nhật `docs/PERMISSIONS.md` và test manifest: không có host permission bắt buộc.

### API key

- Lưu ở `chrome.storage.local` (không `storage.sync`, không IndexedDB). Tuỳ chọn "Không lưu key" dùng `chrome.storage.session`, mất khi đóng trình duyệt.
- Ô nhập dạng password, có nút hiện/ẩn và "Xoá key". Giao diện nói rõ key được lưu không mã hoá trên máy này.
- Nút **Kiểm tra kết nối** gửi request rất nhỏ, báo thành công hoặc lỗi đã chuẩn hoá.
- Lần đầu bật AI hiện hộp xác nhận: nội dung phần được tóm tắt sẽ gửi tới nhà cung cấp X theo chính sách của nhà cung cấp đó.

### Tóm tắt (`src/core/summarize/`)

- Đơn vị tóm tắt là một mục trong mục lục (T5). Mục không có văn bản (bản scan) báo không tóm tắt được.
- Ước lượng token: tiếng Việt khoảng 1 token / 3 ký tự, tiếng Anh khoảng 1 token / 4 ký tự. Hàm thuần, có test.
- Mục vượt ngân sách (mặc định khoảng 12k token đầu vào): chia theo đoạn, tóm tắt từng phần rồi gộp (map-reduce hai tầng). Giữ số trang của từng phần để trích dẫn.
- Prompt riêng theo `book | paper | slides | unknown` (T4):
  - `book`: ý chính, lập luận, ví dụ quan trọng;
  - `paper`: vấn đề, phương pháp, kết quả, hạn chế;
  - `slides`: gom ý theo chủ đề, bổ sung ngữ cảnh từ tiêu đề slide.
- Prompt có `PROMPT_VERSION`; đổi prompt thì tăng version.
- Kết quả JSON: `{ "summary": string, "keyPoints": [{ "text": string, "pages": number[] }], "terms": [{ "term": string, "definition": string }] }`. Parser chịu được JSON bọc trong ```json, JSON lỗi (fallback coi toàn bộ là `summary`) và số trang ngoài phạm vi mục (bỏ).
- Ngôn ngữ đầu ra: mặc định tiếng Việt, cài đặt được "Theo ngôn ngữ tài liệu".
- Cache trong IndexedDB: DB **version 2**, store `summaries` (key = hash của `docId + mục + providerId + model + PROMPT_VERSION + ngôn ngữ`, index `by-doc`). Migration từ version 1 giữ nguyên dữ liệu cũ, có test. `deleteDocumentData` và `clearAllData` xoá cả `summaries`.

### Giao diện

- Tab **Tóm tắt** trong thanh bên: nút "Tóm tắt mục này" cho mục đang đọc; hiện tóm tắt, ý chính có số trang bấm được, thuật ngữ; nút Tạo lại, Sao chép, Huỷ khi đang chạy; nhãn provider/model và dấu "lấy từ cache".
- "Tóm tắt toàn bộ" (giới hạn 100 trang như v0): trước khi chạy hiện ước lượng số request và token đầu vào, phải xác nhận; chạy tối đa 2 request song song, có tiến độ, huỷ được, mục nào xong hiện ngay.
- Tab Mục lục: mục đã có tóm tắt hiện dấu nhỏ.
- Cài đặt → AI: chọn provider, model, base URL (OpenAI-compatible), key, tuỳ chọn lưu key, ngôn ngữ đầu ra, nút Kiểm tra kết nối.
- Mọi chữ hiển thị nằm trong `src/i18n/vi.ts`, câu chữ tự nhiên; lỗi nói rõ cần làm gì (ví dụ "Key không hợp lệ — kiểm tra lại trong Cài đặt → AI").

### Test

- **Tuyệt đối không gọi API thật trong test hay CI, không dùng key thật.** Mock `fetch`, dùng response mẫu tự viết trong `tests/fixtures/llm/`, cả thành công lẫn từng loại lỗi.
- Logic thuần (ước lượng token, chia đoạn, dựng prompt, parse kết quả, cache key, migration, chuẩn hoá lỗi) có test Vitest.
- Phần cần key thật ghi vào "Cần người dùng thử thủ công" trong `PROGRESS.md`.

### Danh sách task v1

**Nhóm D** (T12–T13) trên `feat/v1-ai-core`, **Nhóm E** (T14–T16) trên `feat/v1-summary-ui`. Xong mỗi nhóm thì push, mở PR vào `main`, chạy `gh pr checks --watch` và sửa cho tới khi CI xanh. **Không merge, không tạo tag.**

- [ ] **T12** Core: interface `LLMProvider`, chuẩn hoá lỗi, ước lượng token, chia đoạn, prompt theo loại tài liệu, parser JSON, cache key. Có test.
- [ ] **T13** Bốn provider bằng `fetch`: OpenAI, Gemini, Anthropic, OpenAI-compatible; retry 429, abort, stream nếu gọn. Có test với fetch mock và fixture.
- [ ] **T14** Cài đặt AI: lưu key (local/session), xin quyền host theo provider, kiểm tra kết nối, hộp xác nhận lần đầu; cập nhật `docs/PERMISSIONS.md` và test manifest.
- [ ] **T15** Tab Tóm tắt: tóm tắt mục đang đọc, map-reduce cho mục dài, IndexedDB v2 + store `summaries` + migration, trích dẫn trang bấm được, tóm tắt toàn bộ có ước lượng và xác nhận, huỷ, đánh dấu trong mục lục.
- [ ] **T16** Hoàn thiện: rà lỗi và câu chữ, cập nhật README (phần AI, cách lấy key), `docs/PRIVACY.md` (dữ liệu nào gửi đi, gửi cho ai, khi nào, key lưu ở đâu), CHANGELOG mục `[Unreleased]`.

## Để sau (không làm ở v1)

- Chrome Side Panel API.
- Chrome built-in AI (Gemini Nano, Summarizer API).
- Hỏi đáp theo tài liệu có trích dẫn trang, tìm kiếm ngữ nghĩa (transformers.js, `multilingual-e5-small`), flashcard.
- OCR cho bản scan (tesseract.js, gói `vie`).
- Bản tiếng Anh (`src/i18n/en.ts`), Firefox, đăng Chrome Web Store tự động.
