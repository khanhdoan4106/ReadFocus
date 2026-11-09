# PROGRESS

## Trạng thái
- Nhánh hiện tại: `feat/v0-reading-core`
- Task đang làm: T6 — `search.ts` + chuẩn hoá tiếng Việt + UI tab Tìm kiếm/highlight (chưa bắt đầu)
- Bước tiếp theo chính xác: viết `src/core/search.ts` (chuẩn hoá bỏ dấu tiếng Việt, MiniSearch theo đoạn có số trang, snippet) + test Vitest, rồi thêm tab Tìm kiếm vào `Sidebar.tsx`, nhảy tới trang và highlight text layer.

## Đã hoàn thành
- [x] Khung repo: AGENTS.md, docs/, workflow GitHub Actions (do người dùng tạo sẵn)
- [x] T1 — Scaffold: Vite 8 + TS strict + Preact, crxjs v3, ESLint flat + Prettier, Vitest, manifest MV3 tối thiểu, icon tạm, đủ 6 script npm, `scripts/package.mjs` (commit c34aa8a và 108d72e)
- [x] T2a — Viewer cơ bản: chọn file + kéo thả, pdf.js bundle worker cục bộ, render canvas + text layer, zoom theo nấc + vừa chiều rộng, điều hướng trang (nút, ô nhập, ←/→), lỗi not-pdf/quá lớn/mật khẩu/hỏng (commit 1a21c5c). Đã smoke-test trong trình duyệt: PDF 1 trang render đúng canvas 940×1217, text layer đọc được chữ, zoom 123% → 125%, file .txt báo lỗi đúng.
- [x] T2b — Viewer cuộn liên tục: `PageList` dựng khung mọi trang theo kích thước thật, chỉ render canvas + text layer cho các trang gần vùng nhìn thấy (`computeVisiblePages` trong `src/core/virtualize.ts`, 6 test); theo dõi trang đang đọc khi cuộn; nhảy tới trang giữ đúng trang neo khi zoom; trang lỗi render báo `errorInvalid` (commit d525795). Đã smoke-test bản production trên PDF 6 trang: cuộn tới trang 5 render đúng trang 4–6, nút ←/→ và ô nhập nhảy đúng, zoom 156%→200%→150% vẫn ở trang 5.
- [x] T3 — Storage: `src/core/hash.ts` (SHA-256 bằng `crypto.subtle`, 3 test), `src/core/progress.ts` (`sanitizeProgress`, 6 test), `src/storage/db.ts` với `idb` tạo 7 object store (`documents`, `pages`, `toc`, `searchIndex`, `progress`, `stats`, `settings`); viewer băm file, ghi metadata, lưu trang đang đọc sau 400 ms và khôi phục khi mở lại cùng file (commit fcf29b4). Đã smoke-test bản production: đọc tới trang 4, tải lại trang rồi mở lại file thì nhảy đúng trang 4, IndexedDB có đúng bản ghi `documents` và `progress`.
- [x] Fix T3 — Khi mở lại tài liệu, `PageList` báo trang 1 ở vị trí cuộn ban đầu và ghi đè trang vừa khôi phục trước khi lệnh cuộn chạy. Thêm `acceptPageReport`/`canPersistProgress` trong `src/core/progress.ts` (4 test) và cổng `restoringRef` ở `App.tsx`: bỏ qua báo cáo trang và không ghi tiến độ cho tới khi nhảy xong tới trang khôi phục (commit 7df2c63).
- [x] T4 — Trích văn bản tăng dần + phân loại tài liệu: `src/core/text.ts` (ghép text pdf.js, chuẩn hoá, đếm từ; 8 test), `src/core/profile.ts` (`buildProfile`, `outlineDepth`, phát hiện bản scan; 11 test), `src/viewer/extract.ts` (trích từng trang, nhường UI giữa các trang, đọc độ sâu outline), lưu văn bản theo trang vào IndexedDB (`savePageTexts`, `clearPageTexts`). Viewer hiện nhãn loại tài liệu (Sách/Bài báo/Slide/Chưa rõ), thanh tiến độ trích, cảnh báo bản scan và form chọn khoảng trang khi tài liệu dài hơn 100 trang. Thêm `scripts/make-fixtures.mjs` (script `npm run fixtures`) tạo 4 PDF fixture tự sinh trong `tests/fixtures/`; đã kiểm tra cả 4 file mở được bằng pdf.js trong Node và trích đúng text/kích thước trang.
- [x] T5 — Mục lục: `src/core/toc.ts` với đủ 4 tầng fallback (outline → heuristic tiêu đề → gom slide cùng chủ đề → chia mỗi 10 trang), điền `endPage`/`wordCount`, 10 test. `src/viewer/extract.ts` gom text theo dòng kèm cỡ chữ/đậm và phân giải outline PDF thành số trang (`getDestination`/`getPageIndex`). `Sidebar.tsx` + tab Mục lục: danh sách thụt cấp, bấm để nhảy trang, mục đang đọc được làm nổi bật; nút Mục lục trên toolbar bật/tắt thanh bên. Đã smoke-test bản production trên 4 fixture: `book.pdf` → 3 mục Chapter 1/2/3, bấm Chapter 3 nhảy đúng trang 6 và đổi mục nổi bật; `paper.pdf` → Bài báo; `slides.pdf` → Slide với 4 mục theo slide; `scanned.pdf` → cảnh báo bản scan, không lỗi console.

## Dở dang / ghi chú cho phiên sau
- Repo đã có remote `origin` (https://github.com/khanhdoan4106/ReadFocus.git), `main` đã push, `gh` cài ở `C:\Program Files\GitHub CLI\gh.exe` (không có trong PATH — gọi bằng đường dẫn đầy đủ).
- CI nhóm A đã chạy xanh trên PR #4 (đã merge). Nhánh `feat/v0-reading-core` sẽ mở PR nhóm B sau T7.
- PR nhóm A (`feat/v0-foundation` → `main`) đã merge qua PR #4; ba PR Dependabot nâng action lên v7 cũng đã merge.
- `docs/PLAN.md` đã tách T2 thành T2a/T2b.
- **Cảnh báo khi test tự động**: pdf.js v6 dùng `requestAnimationFrame` để render, nên khi cửa sổ Chrome test bị ẩn/che, render treo ở `renderTask.promise` và text layer rỗng. Đây là hành vi của pdf.js (tab ẩn cũng bị throttle), không phải lỗi app; khi test bằng công cụ browser phải thay tạm `window.requestAnimationFrame` bằng `setTimeout` trong trang. Sự kiện `scroll` thật cũng có thể không phát khi tab không hiển thị — khi đó phải `dispatchEvent(new Event('scroll'))`.

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
- **Virtualize bằng tính toán vị trí + `setTimeout` 50 ms, không dùng `IntersectionObserver`**: giữ mọi trang dưới dạng khung có chiều cao thật để thanh cuộn ổn định, chỉ render canvas/text layer cho các trang trong vùng nhìn thấy cộng một màn hình mỗi phía; logic thuần nằm ở `computeVisiblePages` nên test được bằng Vitest, và tránh được việc IO không phát trong môi trường test.
- **Trang đang đọc xác định theo mốc 30% chiều cao khung nhìn**, không theo trang ở đỉnh: đọc khớp cảm giác khi trang cao hơn màn hình.
- **Khi đổi zoom, ghi nhớ trang đang đọc (`anchorPageRef`) trước khi đổi scale rồi cuộn lại đúng trang đó**; đặt lại `pageNumber` ngay sau khi cuộn để nhãn trang không nhảy do tính toán trung gian.
- **IndexedDB tên `readfocus`, version 1, 7 object store** đúng danh sách trong PLAN: `documents` (keyPath `id`), `pages` (key `[docId, page]`, index `by-doc`), `toc`, `searchIndex`, `progress` (key `docId`), `stats` (key `date`), `settings` (key `key`). T3 chỉ dùng `documents` và `progress`; các store còn lại để dành cho T4–T8 nhưng tạo ngay để khỏi phải nâng version nhiều lần.
- **Băm SHA-256 chạy song song với việc mở pdf.js** trên cùng buffer: giữ được yêu cầu hiển thị trang đầu nhanh, vẫn biết trang cần khôi phục trước khi render. Nếu `crypto.subtle` lỗi thì vẫn cho đọc, chỉ không lưu tiến độ (`hashData` trả `null`).
- **Lưu tiến độ sau 400 ms kể từ lần đổi trang cuối**, tránh ghi IndexedDB liên tục khi cuộn; lỗi lưu trữ bị nuốt im lặng để không chặn việc đọc.
- **`sanitizeProgress` kiểm tra dữ liệu đọc từ IndexedDB** (trang không hợp lệ, vượt số trang, thiếu `updatedAt`) trước khi dùng, vì dữ liệu có thể do bản cũ ghi hoặc bị hỏng.
- **Heuristic phân loại tài liệu** (`buildProfile`): trang có ít hơn 5 từ coi như không có lớp chữ; bản scan khi dưới 50% trang có chữ; slide khi ≥60% trang ngang và trung bình ≤120 từ/trang có chữ; paper khi có cả "Abstract/Tóm tắt" và "References/Tài liệu tham khảo"; sách khi outline sâu ≥2 cấp hoặc có "Chương/Chapter" + số. Thứ tự ưu tiên slide → paper → sách để hình dạng trang thắng dấu hiệu chữ.
- **Trích văn bản chạy nền, mỗi trang xong nghỉ một nhịp `setTimeout(0)`** và lưu theo lô 10 trang vào object store `pages`; không đọc lại cache khi mở lại (T6 sẽ dùng lại store này cho chỉ mục tìm kiếm, lúc đó mới cần bỏ qua trích lại).
- **Tài liệu >100 trang không tự trích**: hiện form chọn khoảng trang (mặc định 1–100), chặn khoảng >100 trang và khoảng ngoài tài liệu. Việc xem PDF vẫn không giới hạn, đúng PLAN.
- **Fixture PDF tự sinh bằng `scripts/make-fixtures.mjs`** (tự viết writer PDF tối giản, không thêm dependency): 4 file book/paper/slides/scanned trong `tests/fixtures/`, dùng cho thử tay và đối chiếu heuristic; đã xác nhận pdf.js trong Node đọc được text và kích thước trang.
- **Mục lục ưu tiên outline PDF**, phân giải `dest` bằng `getDestination`/`getPageIndex`; khi không có outline mới dùng heuristic tiêu đề: dòng ≤12 từ, ≤100 ký tự, khớp `Chương|Chapter|Phần|Part|Mục|Bài|số thứ tự`, và cỡ chữ ≥1,15 lần cỡ chữ thân bài (hoặc đậm với cỡ ≥1,02 lần). Cỡ chữ thân bài là cỡ chiếm nhiều ký tự nhất để tiêu đề lớn không làm lệch ngưỡng.
- **Tầng slide gom theo tiêu đề dòng đầu trang**, bỏ hậu tố `(1)`, `- 2`, `(tiếp)` để các slide liên tiếp cùng chủ đề nhập một mục; slide không có tiêu đề dòng đầu bị bỏ qua và rơi xuống tầng chia 10 trang.
- **Mục chia 10 trang để `title` rỗng**, UI hiện "Trang X–Y" qua `vi.tocPageRange`; core không chứa chuỗi hiển thị.
- **Thanh bên một tab Mục lục** (đúng phạm vi T5), dựng sẵn `role="tablist"` để T6 thêm tab Tìm kiếm; bật/tắt bằng nút trên toolbar, mặc định mở. Với tài liệu >100 trang, outline được hiện ngay trước khi người dùng chọn khoảng trang.
- Node cục bộ là 26.13.0, `.nvmrc` vẫn là 22 theo PLAN; CI dùng Node 22.

## Cần người dùng thử thủ công / trả lời
- Load unpacked `dist/` trong `chrome://extensions`, xác nhận: extension hiện tên ReadFocus, icon hiển thị rõ ở 16/48/128, bấm icon trên toolbar mở tab `viewer.html`.
- Trong viewer: mở một PDF thật (sách/paper nhiều trang), thử kéo thả, cuộn liên tục, nhảy trang, zoom, ←/→; báo lỗi nếu chữ trong text layer lệch khỏi chữ trên canvas hoặc nếu cuộn bị giật khi tài liệu dài.
- Kiểm tra lưu tiến độ: đọc tới một trang giữa, đóng tab, mở lại bằng nút toolbar rồi mở đúng file đó — viewer phải nhảy về trang đã đọc. Mở một file khác phải bắt đầu từ trang 1.
- Kiểm tra T4 bằng 4 file trong `tests/fixtures/` (chạy `npm run fixtures` nếu chưa có): `book.pdf` phải hiện nhãn "Sách", `paper.pdf` → "Bài báo", `slides.pdf` → "Slide", `scanned.pdf` → cảnh báo bản scan. Thử một PDF thật >100 trang để xem form chọn khoảng trang và tiến độ trích.
- Kiểm tra T5: mở một PDF có bookmark thật, xác nhận mục lục nhiều cấp, bấm mục nhảy đúng trang, cuộn thì mục đang đọc được làm nổi bật, nút "Mục lục" ẩn/hiện thanh bên.
- Review PR nhóm A trên GitHub (đã merge qua PR #4).

## Dependency đã thêm (và lý do)
- `preact` — UI nhẹ theo stack đã chốt.
- `vite`, `@crxjs/vite-plugin` — build MV3.
- `@preact/preset-vite` — JSX + fast refresh cho Preact.
- `typescript` (~5.9.3), `@types/chrome`, `@types/node` — kiểu.
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier` — lint/format.
- `vitest` — unit test.
- `fflate` — tạo file zip trong `scripts/package.mjs`.
- `pdfjs-dist` (6.5.438) — render PDF; worker bundle qua `?url` nên không tải code từ xa.
- `idb` (8.0.4) — lớp mỏng trên IndexedDB, có kiểu cho schema; dùng cho T3 trở đi.
