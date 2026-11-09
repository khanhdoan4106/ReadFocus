# PERMISSIONS — ReadFocus

Mỗi quyền trong `manifest.json` phải có lý do rõ ràng. ReadFocus không gửi dữ liệu ra mạng ở v0.

| Quyền | Dùng ở đâu | Lý do |
|---|---|---|
| `storage` | `src/storage/db.ts` | Lưu metadata tài liệu, tiến độ đọc, mục lục, chỉ mục tìm kiếm, thống kê và cài đặt trong IndexedDB của máy. |
| `notifications` | `src/viewer/App.tsx` | Báo khi hết giờ đọc chương hoặc hết phiên Pomodoro/giờ nghỉ, kể cả lúc tab đang ẩn. Không có nội dung nào được gửi ra ngoài. |

## Quyền cố ý không dùng

- Không dùng `<all_urls>`, `tabs` hay host permission rộng: viewer chỉ mở file do người dùng chọn hoặc file PDF do người dùng chủ động đưa vào.
- `file://` không bật sẵn; người dùng tự bật "Allow access to file URLs" trong trang quản lý extension nếu muốn mở file trên máy.
