# Quyền của extension

Mỗi quyền trong `manifest.json` phải có một dòng ở đây. Quyền nào không có lý do thì bỏ khỏi manifest.

| Quyền | Dùng để làm gì | Thêm ở task |
|---|---|---|
| `storage` | Lưu cài đặt nhỏ (`chrome.storage.local`) | T1 |
| _(điền tiếp khi thêm quyền)_ | | |

## Quyền nhạy cảm — phải hỏi người dùng trước khi thêm

- `<all_urls>` hoặc host permission rộng
- truy cập `file://`
- `tabs` kèm host rộng, `webRequest`, `history`, `downloads`

## Dự kiến (chưa thêm)

- `contextMenus`: mục "Mở bằng ReadFocus" (T9)
- `notifications`: báo hết giờ Pomodoro (T8)
- `declarativeNetRequest` + host `*://*/*.pdf`: tự chuyển PDF sang viewer, chỉ khi người dùng bật (T9, cần hỏi trước)
