# Quyền riêng tư

ReadFocus xử lý PDF và mọi dữ liệu đọc ngay trên máy. Bản v0 không gửi dữ liệu ra ngoài, không có analytics, telemetry, quảng cáo hay thư viện tải từ CDN.

## Dữ liệu được lưu

Khi bạn mở một tài liệu, ReadFocus lưu vào IndexedDB của extension (cơ sở dữ liệu `readfocus`):

- tên file, kích thước, số trang, thời điểm mở;
- văn bản trích từ từng trang (để tìm kiếm và ước tính thời gian);
- mục lục và chỉ mục tìm kiếm;
- trang đang đọc và thời gian đã đọc;
- thống kê số phút, số trang theo ngày;
- cài đặt như giao diện, tốc độ đọc, Pomodoro và chiều cao dải sáng.

Ngoài ra:

- **`localStorage`** giữ đúng một giá trị `readfocus:theme` để áp giao diện trước khi viewer render, tránh nháy màu.
- **`chrome.storage.sync`** chỉ giữ cờ `autoOpenPdf` (bật/tắt tự mở PDF). Nếu bạn đăng nhập Chrome, cờ này có thể được Chrome đồng bộ theo tài khoản Google của bạn; không có nội dung tài liệu nào được đồng bộ.

Tài liệu gốc không bị sửa và không bị sao chép ra khỏi máy.

## Dữ liệu không được gửi đi

- Không có máy chủ của ReadFocus.
- Không gửi nội dung PDF, văn bản trích, mục lục, từ khoá tìm kiếm hay thống kê đọc tới bất kỳ đâu.
- Không có mã theo dõi, không có mã tải từ xa; mọi thư viện được đóng gói sẵn trong extension.

## PDF mở từ web

Khi bạn chủ động mở một PDF trên web (chuột phải → **Mở bằng ReadFocus**, bấm icon khi đang ở tab PDF, hoặc bật tự mở PDF), extension tải đúng địa chỉ đó về máy để hiển thị. Máy chủ chứa file thấy request giống như khi trình duyệt tải file bình thường, kèm địa chỉ IP của bạn; ReadFocus không gửi thêm thông tin nào khác.

Nếu bật **Tự mở PDF bằng ReadFocus**, Chrome sẽ hỏi quyền truy cập trang web. Quyền này chỉ dùng để nhận diện và chuyển hướng link `.pdf`; ReadFocus không đọc nội dung các trang bạn truy cập và không ghi lại lịch sử duyệt web.

## Quyền của extension

Danh sách đầy đủ và lý do từng quyền nằm ở [`PERMISSIONS.md`](PERMISSIONS.md). Tóm tắt:

- `storage`, `notifications`: lưu dữ liệu cục bộ và báo hết giờ hẹn.
- `contextMenus`, `activeTab`: thêm mục **Mở bằng ReadFocus** và đọc địa chỉ tab khi bạn bấm icon.
- `declarativeNetRequestWithHostAccess`: thêm/gỡ rule chuyển hướng PDF khi bạn bật tính năng tự mở.
- Quyền host `*://*/*` là quyền tuỳ chọn, chỉ được xin khi bạn bật tự mở PDF.

## Xoá dữ liệu

Trong tab **Cài đặt** của viewer:

- **Xoá dữ liệu của …** xoá tiến độ, văn bản, mục lục và chỉ mục tìm kiếm của tài liệu đang mở.
- **Xoá toàn bộ dữ liệu đọc** xoá dữ liệu của mọi tài liệu và thống kê; cài đặt giao diện/tốc độ được giữ nguyên.

Gỡ extension khỏi Chrome cũng xoá IndexedDB và `localStorage` của ReadFocus.

## Bản v1

Khi thêm tính năng AI, ReadFocus sẽ chỉ dùng API key do bạn tự nhập và chỉ gửi nội dung khi bạn chủ động yêu cầu tóm tắt. Kế hoạch này chưa được triển khai trong v0.
