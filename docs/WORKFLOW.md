# Quy trình làm việc

## Nhánh và PR

```
main  ← chỉ nhận qua PR, CI phải xanh
 ├─ feat/v0-foundation     (T1–T3)
 ├─ feat/v0-reading-core   (T4–T7)
 ├─ feat/v0-focus-polish   (T8–T11)
 └─ fix/<mô-tả-ngắn>
```

1. Tạo nhánh từ `main` mới nhất.
2. Commit nhỏ, Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `wip:`).
3. Push, mở PR theo mẫu `.github/pull_request_template.md`.
4. CI (`ci.yml`) chạy typecheck, lint, test, build, package. Bản zip build được đính kèm vào lượt chạy CI để tải về thử.
5. Người dùng tự review, thử thủ công, rồi merge (squash hoặc merge commit).

Nên bật **branch protection** cho `main` trên GitHub: Settings → Branches → yêu cầu PR và yêu cầu job `CI / check` pass.

## Chạy agent (OpenCode)

- Phiên đầu: dán Prompt A trong `PROMPT.md`. Các phiên sau: dán Prompt B.
- Agent đọc `AGENTS.md` (luật), `docs/PLAN.md` (việc cần làm), `PROGRESS.md` (đang ở đâu).
- Khi agent in `ĐÃ LƯU TIẾN TRÌNH`, mở phiên mới và dán Prompt B.
- Agent không tạo tag, không phát hành, không sửa `.github/workflows/` khi chưa hỏi.

## Phát hành (người dùng tự làm)

1. Trên một nhánh `chore/release-x.y.z`: tăng `version` trong `package.json` **và** `manifest.json` cho khớp, cập nhật `CHANGELOG.md`, mở PR, merge.
2. Từ `main` đã cập nhật:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. Workflow `release.yml` kiểm tra tag khớp version, build, tạo GitHub Release kèm file `readfocus-vX.Y.Z.zip`.
4. Đăng lên Chrome Web Store: tải file zip đó lên Developer Dashboard (làm tay ở v0).

Tag có dấu gạch (ví dụ `v0.1.0-beta.1`) sẽ được đánh dấu là pre-release.
