# PERMISSIONS — ReadFocus

Mỗi quyền trong `manifest.json` phải có lý do rõ ràng. ReadFocus không gửi dữ liệu ra mạng ở v0.

| Quyền | Dùng ở đâu | Lý do |
|---|---|---|
| `storage` | `src/storage/db.ts` | Lưu metadata tài liệu, tiến độ đọc, mục lục, chỉ mục tìm kiếm, thống kê và cài đặt trong IndexedDB của máy. |
| `notifications` | `src/viewer/App.tsx` | Báo khi hết giờ đọc chương hoặc hết phiên Pomodoro/giờ nghỉ, kể cả lúc tab đang ẩn. Không có nội dung nào được gửi ra ngoài. |
| `contextMenus` | `src/background/service-worker.ts` | Thêm mục "Mở bằng ReadFocus" khi bấm chuột phải vào trang hoặc link PDF. |
| `activeTab` | `src/background/service-worker.ts` | Đọc địa chỉ tab hiện tại khi người dùng bấm icon hoặc menu để mở đúng PDF đó. Quyền chỉ có hiệu lực sau thao tác của người dùng, không theo dõi duyệt web. |
| `declarativeNetRequestWithHostAccess` | `src/background/service-worker.ts` | Cho phép thêm/gỡ dynamic rule chuyển hướng PDF khi người dùng bật tính năng tự mở. Bản thân quyền này không đọc nội dung trang; rule chỉ chạy khi quyền host tuỳ chọn bên dưới được cấp. |

## Quyền host tuỳ chọn

`optional_host_permissions: ["*://*/*"]` chỉ được xin khi người dùng bật công tắc **Tự mở PDF bằng ReadFocus** trong tab Cài đặt. Lúc cài extension không có cảnh báo "đọc mọi trang web". Khi bật:

- `chrome.permissions.request` xin quyền trong một thao tác bấm của người dùng.
- Nếu người dùng từ chối, công tắc trở về TẮT và không có rule nào được thêm.
- Nếu được cấp, service worker thêm một dynamic rule ID `9001` chỉ áp cho `main_frame` có URL http(s) kết thúc bằng `.pdf`.
- Tắt công tắc sẽ gỡ rule rồi gỡ quyền host. Nếu người dùng thu hồi quyền trong `chrome://extensions`, service worker tự gỡ rule và đặt trạng thái về TẮT.

`web_accessible_resources` cho `viewer.html` với `matches: ["<all_urls>"]` là cần thiết để rule chuyển hướng được phép mở trang viewer của extension.

## Quyền cố ý không dùng

- Không dùng `host_permissions` cố định cho `*://*/*`, `<all_urls>`, `tabs` hay `file://`: chỉ quyền host tuỳ chọn ở trên, do người dùng chủ động cấp.
- `file://` không bật sẵn; người dùng tự bật "Allow access to file URLs" trong trang quản lý extension nếu muốn mở file trên máy. Khi nhận địa chỉ `file://`, viewer hiện hướng dẫn thay vì cố đọc.
- Không dùng host permission cố định cho `*.pdf`; rule chuyển hướng dùng quyền host tuỳ chọn `*://*/*` vì Chrome bỏ qua phần path trong host permission.
