# Prompt cho OpenCode

Repo đã có sẵn khung: `AGENTS.md` (luật, OpenCode tự đọc), `docs/PLAN.md` (đặc tả và task), `PROGRESS.md` (tiến trình), CI ở `.github/workflows/`.

Phiên đầu dán **Prompt A**, các phiên sau dán **Prompt B**.

---

## Prompt A — phiên đầu tiên

Bạn sẽ xây dựng ReadFocus v0, một extension Chrome (Manifest V3) hỗ trợ đọc PDF.

1. Đọc `AGENTS.md` và tuân thủ tuyệt đối, đặc biệt mục 3 (lưu tiến trình) và mục 6 (Git).
2. Đọc `docs/PLAN.md`, `docs/WORKFLOW.md`, `PROGRESS.md`. Nếu thấy task nào quá lớn cho một lần làm, tách nhỏ trong `docs/PLAN.md`.
3. Tạo nhánh `feat/v0-foundation` từ `main`.
4. Làm T1. Lưu ý T1 phải tạo đủ 6 script npm trong bảng của PLAN, vì CI chạy đúng các script đó.
5. Tiếp tục T2, T3 theo quy trình trong `AGENTS.md`. Xong nhóm A thì push và mở PR vào `main` theo mẫu `.github/pull_request_template.md`.

Bắt đầu.

---

## Prompt B — các phiên tiếp theo

Tiếp tục dự án ReadFocus.

1. Đọc `AGENTS.md`, `PROGRESS.md`, `docs/PLAN.md`.
2. Chạy `git status` và `git log --oneline -15`, đối chiếu với `PROGRESS.md`. Nếu có commit `wip:`, hoàn thành phần dở dang đó trước.
3. Nếu PR gần nhất có CI đỏ (`gh pr checks`), sửa cho xanh trước khi làm task mới.
4. Báo ngắn gọn trong 3–5 dòng: đang ở đâu và sẽ làm gì tiếp.
5. Làm tiếp theo đúng quy trình, và lưu tiến trình theo mục 3 của `AGENTS.md`.
