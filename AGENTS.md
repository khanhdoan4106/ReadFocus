# AGENTS.md — ReadFocus

> Tên "ReadFocus" là tên tạm, có thể đổi sau. File này là luật bắt buộc cho mọi phiên làm việc của agent.

## 1. Dự án

ReadFocus là extension Chrome (Manifest V3), mã nguồn mở (MIT), giúp đọc tài liệu PDF như sách, paper hay slide bài giảng nhanh và tập trung hơn. Extension có các phần: mục lục tự động, tìm kiếm, ước tính thời gian đọc, hẹn giờ theo chương, focus mode. Từ v1 có thêm tóm tắt bằng AI, người dùng tự nhập API key của mình.

- v0, v1, v2 (OCR, tìm kiếm theo ý nghĩa, hỏi đáp có trích dẫn, flashcard) và v3 (tách App.tsx, tiếng Anh, icon, hồ sơ Chrome Web Store, embedding chạy trên máy) đã xong (PR #4–#18). Giai đoạn hiện tại là **v4: ghi chú/highlight theo trang (nhóm M) và đồng bộ tiến độ đọc qua `chrome.storage.sync` (nhóm N)**. Dữ liệu chỉ rời máy khi người dùng chủ động dùng tính năng AI qua key của họ, đồng ý tải model về chạy trên máy, hoặc tự bật đồng bộ tiến độ (xem mục 4).
- Kế hoạch chi tiết nằm ở `docs/PLAN.md`. Tiến trình nằm ở `PROGRESS.md`.

## 2. Quy trình mỗi phiên (bắt buộc)

1. Đọc `AGENTS.md`, `PROGRESS.md` và `docs/PLAN.md`.
2. Chạy `git status` và `git log --oneline -15` để đối chiếu với `PROGRESS.md`. Nếu hai bên lệch nhau, **tin vào code và git**, rồi sửa lại `PROGRESS.md`.
3. Lấy task tiếp theo chưa xong trong `docs/PLAN.md`. **Mỗi lần chỉ làm một task.**
4. Làm xong một task thì: build, lint, test đều pass, rồi commit, rồi cập nhật `PROGRESS.md`, rồi commit file này.
5. Lặp lại bước 3 cho đến khi hết việc hoặc phải dừng theo mục 3.

## 3. Lưu tiến trình khi sắp hết token hoặc ngữ cảnh

Phiên có thể bị cắt bất cứ lúc nào. Vì vậy:

- **Cập nhật `PROGRESS.md` sau MỖI task**, không đợi đến cuối phiên.
- **Dừng nhận việc mới** khi thấy một trong các dấu hiệu sau:
  - hội thoại đã rất dài;
  - đã đọc nhiều file lớn hoặc nhiều output dài;
  - công cụ báo sắp tóm tắt hoặc compact ngữ cảnh;
  - đã xong khoảng 3–4 task trong phiên này.
- Khi dừng, làm đúng thứ tự:
  1. Tắt mọi dev server và tiến trình chạy ngầm (vite dev/preview, watcher) trước khi kết thúc phiên.
  2. Đưa code về trạng thái build được. Nếu task dở dang chưa build được, commit lên nhánh hiện tại với message bắt đầu bằng `wip:`.
  3. Cập nhật `PROGRESS.md` thật cụ thể: đang dở ở file nào, hàm nào, bước tiếp theo chính xác là gì.
  4. Commit.
  5. In ra dòng: `ĐÃ LƯU TIẾN TRÌNH — phiên sau bắt đầu từ: <task/bước>`.
- Không bắt đầu một task lớn khi không chắc còn đủ ngữ cảnh để làm xong. Trong trường hợp đó, chia task nhỏ ra trong `docs/PLAN.md` trước.
- Hạn chế đọc thừa để tiết kiệm ngữ cảnh: đọc file theo đoạn cần thiết, không in toàn bộ `node_modules`, log build dài hay file PDF.

### Mẫu `PROGRESS.md`

```markdown
# PROGRESS

## Trạng thái
- Nhánh hiện tại: feat/...
- Task đang làm: T? — <tên> (xong / dở dang)
- Bước tiếp theo chính xác: ...

## Đã hoàn thành
- [x] T1 — ... (commit abc1234)

## Dở dang / ghi chú cho phiên sau
- ...

## Quyết định đã đưa ra (và lý do)
- ...

## Cần người dùng thử thủ công / trả lời
- ...

## Dependency đã thêm (và lý do)
- ...
```

## 4. Luật code

- TypeScript `strict`. Không dùng `any`, trừ khi có comment giải thích lý do.
- **Không tải code từ xa**, vì MV3 cấm remote code. Mọi thư viện cài qua npm và bundle vào extension, kể cả worker của `pdfjs-dist`.
- **Chỉ gửi dữ liệu ra mạng khi người dùng chủ động bấm tóm tắt hoặc kiểm tra kết nối**, và chỉ tới đúng nhà cung cấp AI người dùng đã chọn. Không analytics, không telemetry, không CDN, không gọi API ngầm. API key không bao giờ được ghi vào log, thông báo lỗi, test hay commit.
- **Tải model AI chạy trên máy chỉ khi người dùng đồng ý**, tải một lần rồi lưu cache, chỉ từ nguồn đã ghi trong PLAN. Thư viện và file wasm phải bundle cục bộ, không tải từ CDN. OCR chạy hoàn toàn trên máy.
- Quyền trong manifest giữ ở mức tối thiểu. Mỗi quyền phải ghi lý do trong `docs/PERMISSIONS.md`.
- Logic thuần đặt trong `src/core/`, tách khỏi UI, và **phải có unit test Vitest**. Logic thuần gồm: trích mục lục, nhận diện loại tài liệu, đếm từ, ước tính thời gian, chuẩn hóa tiếng Việt, tìm kiếm, gọi và chuẩn hóa lỗi nhà cung cấp AI (`src/core/llm/`), tóm tắt, chia đoạn, cache và lập kế hoạch tóm tắt (`src/core/summarize/`), OCR (`src/core/ocr/`), embedding và tìm kiếm ngữ nghĩa (`src/core/embed/`), hỏi đáp (`src/core/ask/`), flashcard (`src/core/flashcard/`), ghi chú và highlight (`src/core/annotate/`), đồng bộ tiến độ (`src/core/sync/`).
- Ghi chú và highlight là nội dung người dùng tự tạo: không bao giờ xóa mà không có xác nhận rõ ràng. Dữ liệu đồng bộ chỉ gồm những gì ghi trong PLAN, không bao giờ có văn bản PDF hay ghi chú.
- Chỉ thêm dependency khi thật sự cần, và ghi lý do vào `PROGRESS.md`.
- Chỉ sửa những gì thuộc task đang làm. Không refactor lớn ngoài kế hoạch.
- Lỗi phải được báo rõ ràng cho người dùng, không để crash: PDF hỏng, PDF có mật khẩu, PDF không có lớp chữ (bản scan), file quá lớn.
- Hiệu năng:
  - hiển thị trang đầu ngay;
  - trích văn bản và lập chỉ mục dần dần, không chặn UI;
  - chỉ render các trang đang nằm trong vùng nhìn thấy (virtualize).
- Tài liệu trên 100 trang: vẫn xem được toàn bộ, nhưng phải cảnh báo và cho người dùng chọn khoảng trang để lập chỉ mục.
- Không commit file PDF có bản quyền. File test tự tạo, đặt trong `tests/fixtures/`.

## 5. Giao diện

- Mọi chữ hiển thị là **tiếng Việt tự nhiên**, gom hết vào `src/i18n/vi.ts`, cấu trúc sẵn để sau thêm `en`.
- Khi làm hoặc sửa giao diện, rà cả **câu chữ** chứ không chỉ bố cục: ngắn gọn, đúng giọng, không dịch máy.
- Hỗ trợ dark mode (theo hệ thống, có thể chỉnh tay) và phím tắt. Có `aria-*` và trạng thái focus bàn phím rõ ràng.

## 6. Git

- **Không commit hoặc push thẳng vào `main`.** Mỗi nhóm việc làm trên một nhánh `feat/...` hoặc `fix/...`, rồi mở pull request.
- Commit nhỏ, theo Conventional Commits, message bằng tiếng Anh.
- **Không để lại dấu vết AI** ở commit, PR hay code: không có `Co-Authored-By`, không có "Generated with ...", không có tên agent.
- Không commit `node_modules/`, `dist/`, file `.zip` build hay file bí mật.
- Không `push --force`, không xóa nhánh, không đổi remote khi chưa hỏi người dùng.
- Tên nhánh và cách chia nhóm PR theo `docs/PLAN.md`; quy trình đầy đủ ở `docs/WORKFLOW.md`.
- **Không tạo tag, không phát hành.** Việc tăng version và phát hành do người dùng làm.
- Nếu CI trên PR đỏ: đọc log, sửa trên cùng nhánh. Không tắt bước kiểm tra, không thêm `skip`/`--passWithNoTests` để né lỗi.

## 7. Khi nào phải dừng lại hỏi người dùng

- Muốn sửa bất kỳ file nào trong `.github/workflows/`.
- Muốn thay đổi quyết định kiến trúc đã ghi trong `docs/PLAN.md`.
- Muốn thêm quyền nhạy cảm như `<all_urls>`, `file://` hay `tabs` với host rộng.
- Thao tác xóa dữ liệu hoặc không đảo ngược được.

Những việc còn lại: tự quyết định hợp lý và ghi lý do vào mục "Quyết định" trong `PROGRESS.md`.

## 8. Một task được coi là hoàn thành khi

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` và `npm run package` đều pass (đúng các bước CI chạy).
- Phần cần thử thủ công (load unpacked vào Chrome) đã được ghi vào `PROGRESS.md`, mục "Cần người dùng thử thủ công".
- `PROGRESS.md` đã cập nhật và đã commit.
