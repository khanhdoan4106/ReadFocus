# PLAN — ReadFocus v0

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

- Trang viewer riêng của extension (`viewer.html`) có thanh bên tích hợp gồm các tab: Mục lục, Tìm kiếm, Tập trung, Cài đặt.
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
- [ ] **T4** Trích văn bản tăng dần + `profile.ts` + phát hiện bản scan + cảnh báo trên 100 trang. Script tạo PDF fixture trong `scripts/`. Có test.
- [ ] **T5** `toc.ts`, đủ 4 tầng fallback, có test; UI tab Mục lục.
- [ ] **T6** `search.ts` + chuẩn hóa tiếng Việt, có test; UI tab Tìm kiếm + highlight.
- [ ] **T7** `reading-time.ts` + học tốc độ đọc, có test; hiển thị thời gian trong mục lục.
- [ ] **T8** Tập trung: hẹn giờ theo chương, Pomodoro, focus mode, phát hiện không hoạt động, thống kê.
- [ ] **T9** Mở PDF từ web: context menu, nút toolbar, tùy chọn tự chuyển (mặc định tắt), hướng dẫn `file://`; hoàn thiện `docs/PERMISSIONS.md`.
- [ ] **T10** Cài đặt, dark mode, phím tắt, các trạng thái lỗi; rà toàn bộ câu chữ tiếng Việt.
- [ ] **T11** Hoàn thiện README (tính năng, cài unpacked, build, quyền riêng tư), viết `docs/PRIVACY.md`, kiểm tra `npm run package`, cập nhật mục v1 bên dưới.

## Để sau (không làm ở v0)

- Chrome Side Panel API.
- **v1:** AI theo kiểu người dùng tự nhập key (lớp `LLMProvider` chung: OpenAI, Gemini, Claude, Ollama, Chrome built-in AI); tóm tắt theo mục, cache kết quả; prompt riêng cho từng loại tài liệu.
- **v2:** hỏi đáp có trích dẫn trang, tìm kiếm ngữ nghĩa (transformers.js, `multilingual-e5-small`), flashcard, OCR (tesseract.js, gói `vie`).
- Bản tiếng Anh (`src/i18n/en.ts`), Firefox, đăng Chrome Web Store tự động.
