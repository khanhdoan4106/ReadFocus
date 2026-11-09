# PERMISSIONS — ReadFocus

Mỗi quyền trong `manifest.json` phải có lý do rõ ràng. ReadFocus không gửi dữ liệu ra mạng ở v0.

| Quyền | Dùng ở đâu | Lý do |
|---|---|---|
| `storage` | `src/storage/db.ts` | Lưu metadata tài liệu, tiến độ đọc, mục lục, chỉ mục tìm kiếm, thống kê và cài đặt trong IndexedDB của máy. |
| `notifications` | `src/viewer/App.tsx` | Báo khi hết giờ đọc chương hoặc hết phiên Pomodoro/giờ nghỉ, kể cả lúc tab đang ẩn. Không có nội dung nào được gửi ra ngoài. |
| `contextMenus` | `src/background/service-worker.ts` | Thêm mục "Mở bằng ReadFocus" khi bấm chuột phải vào trang hoặc link PDF. |
| `activeTab` | `src/background/service-worker.ts` | Đọc địa chỉ tab hiện tại khi người dùng bấm icon hoặc menu để mở đúng PDF đó. Quyền chỉ có hiệu lực sau thao tác của người dùng, không theo dõi duyệt web. |

## Quyền cố ý không dùng

- Không dùng `<all_urls>`, `tabs` hay host permission rộng: viewer chỉ mở file do người dùng chọn hoặc PDF do người dùng chủ động đưa vào. PDF trên web được tải bằng quyền `activeTab` của tab vừa thao tác; nếu trang chặn tải, viewer báo lỗi và hướng dẫn tải file về máy.
- `file://` không bật sẵn; người dùng tự bật "Allow access to file URLs" trong trang quản lý extension nếu muốn mở file trên máy. Khi nhận địa chỉ `file://`, viewer hiện hướng dẫn thay vì cố đọc.
- Chưa dùng `declarativeNetRequest` và host `*.pdf`: tính năng tự chuyển mọi PDF sang ReadFocus đang chờ người dùng quyết định vì đây là quyền nhạy cảm.
