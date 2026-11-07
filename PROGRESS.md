# PROGRESS

## Trạng thái
- Nhánh hiện tại: `feat/v0-foundation`
- Task đang làm: T2b — Viewer cuộn liên tục (chưa bắt đầu)
- Bước tiếp theo chính xác: thay `PdfPage` một-trang bằng danh sách trang cuộn dọc có virtualize (IntersectionObserver + placeholder theo kích thước trang), theo dõi trang đang đọc để cập nhật `pageNumber`, giữ text layer cho từng trang. Sau đó sang T3.

## Đã hoàn thành
- [x] Khung repo: AGENTS.md, docs/, workflow GitHub Actions (do người dùng tạo sẵn)
- [x] T1 — Scaffold: Vite 8 + TS strict + Preact, crxjs v3, ESLint flat + Prettier, Vitest, manifest MV3 tối thiểu, icon tạm, đủ 6 script npm, `scripts/package.mjs` (commit c34aa8a và 108d72e)
- [x] T2a — Viewer cơ bản: chọn file + kéo thả, pdf.js bundle worker cục bộ, render canvas + text layer, zoom theo nấc + vừa chiều rộng, điều hướng trang (nút, ô nhập, ←/→), lỗi not-pdf/quá lớn/mật khẩu/hỏng (commit 1a21c5c). Đã smoke-test trong trình duyệt: PDF 1 trang render đúng canvas 940×1217, text layer đọc được chữ, zoom 123% → 125%, file .txt báo lỗi đúng.

## Dở dang / ghi chú cho phiên sau
- Repo chưa có remote và máy này chưa cài `gh`, nên **chưa push / chưa mở PR** được. Khi có remote: `git remote add origin <url>`, push `feat/v0-foundation`, mở PR vào `main`.
- CI chưa từng chạy thật (chưa có remote). Toàn bộ lệnh CI chạy tay trên Windows đều pass; cần xác nhận lại trên Ubuntu khi mở PR.
- `docs/PLAN.md` đã tách T2 thành T2a/T2b.

## Quyết định đã đưa ra (và lý do)
- **`git init` với commit khung đầu tiên trên `main`**: thư mục dự án chưa phải git repo nên không có `main` để tạo nhánh. Commit đầu chỉ chứa file khung do người dùng tạo sẵn; mọi thay đổi của agent nằm trên `feat/v0-foundation`.
- **Ghim TypeScript `~5.9.3`** thay vì bản 7.x mới nhất: `typescript-eslint` hiện chỉ hỗ trợ TS `<6.1.0`.
- **`@crxjs/vite-plugin` v3 + Vite 8**: chạy được, không cần phương án Vite multi-entry. `viewer.html` không nằm trong manifest nên được khai báo thêm ở `build.rollupOptions.input`.
- **`manifest.json` ở gốc repo**, import vào `vite.config.ts` bằng import attributes; `scripts/package.mjs` đọc lại `dist/manifest.json` để kiểm tra trùng version với `package.json`.
- **Đóng gói zip bằng `fflate`** (thuần JS, chạy được cả Windows và Ubuntu trong CI), không dùng lệnh hệ điều hành.
- **Icon tạm sinh bằng `scripts/make-icons.mjs`** (tự viết PNG encoder bằng `node:zlib`), không thêm dependency vẽ ảnh.
- **Thêm `.gitattributes` (`eol=lf`)** để khớp `.editorconfig` và tránh diff nhiễu do Windows.
- **Giới hạn mềm 200 MB/file** (`MAX_FILE_BYTES`): đủ rộng cho sách/paper, tránh treo tab khi mở file khổng lồ; thông báo lỗi riêng.
- **Text layer dùng `TextLayer` của pdf.js + CSS rút gọn** từ `pdf_viewer.css` (Apache-2.0) thay vì import cả file 168 KB của pdf.js web viewer.
- Node cục bộ là 26.13.0, `.nvmrc` vẫn là 22 theo PLAN; CI dùng Node 22.

## Cần người dùng thử thủ công / trả lời
- Load unpacked `dist/` trong `chrome://extensions`, xác nhận: extension hiện tên ReadFocus, icon hiển thị rõ ở 16/48/128, bấm icon trên toolbar mở tab `viewer.html`.
- Trong viewer: mở một PDF thật (sách/paper nhiều trang), thử kéo thả, zoom, ←/→; báo lỗi nếu chữ trong text layer lệch khỏi chữ trên canvas.
- Cho biết URL remote GitHub để agent push nhánh và mở PR nhóm A.

## Dependency đã thêm (và lý do)
- `preact` — UI nhẹ theo stack đã chốt.
- `vite`, `@crxjs/vite-plugin` — build MV3.
- `@preact/preset-vite` — JSX + fast refresh cho Preact.
- `typescript` (~5.9.3), `@types/chrome`, `@types/node` — kiểu.
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier` — lint/format.
- `vitest` — unit test.
- `fflate` — tạo file zip trong `scripts/package.mjs`.
- `pdfjs-dist` (6.5.438) — render PDF; worker bundle qua `?url` nên không tải code từ xa.
