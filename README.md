# ReadFocus

Extension Chrome giúp đọc PDF dễ chịu hơn: tự lập mục lục, tìm kiếm trong tài liệu, ước tính thời gian đọc, hẹn giờ theo chương và chế độ tập trung. Phù hợp với sách, bài báo khoa học và slide bài giảng.

> 🚧 Đang phát triển bản v0. Kế hoạch chi tiết ở [`docs/PLAN.md`](docs/PLAN.md).

## Tính năng

- **Đọc PDF ngay trong extension**: chọn file, kéo thả hoặc mở PDF từ web. Cuộn liên tục, zoom, nhảy trang; chỉ render những trang đang nhìn thấy nên tài liệu dài vẫn mượt.
- **Mục lục tự động**: lấy bookmark của PDF trước, sau đó đoán tiêu đề theo cỡ chữ và từ khoá, gom slide cùng chủ đề, cuối cùng chia mỗi 10 trang. Bấm một mục để nhảy tới.
- **Tìm kiếm**: tìm theo đoạn, có tuỳ chọn bỏ dấu tiếng Việt (“chuong” khớp “chương”), hiện snippet và tô vàng kết quả trên trang.
- **Ước tính thời gian đọc**: thời gian còn lại của mục đang đọc và của cả tài liệu; tốc độ đọc tự điều chỉnh theo nhịp đọc thực tế, có thể chỉnh tay trong Cài đặt.
- **Tập trung**: hẹn giờ theo chương hoặc Pomodoro 25/5, focus mode làm mờ trang và giữ một dải sáng quanh dòng đang đọc, thống kê phút và số trang theo ngày.
- **Nhận diện tài liệu**: phân loại sách, bài báo, slide; cảnh báo bản scan không có lớp chữ.
- **Cài đặt**: giao diện sáng/tối/theo hệ thống, tốc độ đọc, tự mở PDF trên web, xoá dữ liệu đã lưu.

## Cài đặt

Cần Node 22 và Chrome có hỗ trợ Manifest V3.

```bash
npm ci
npm run build
```

Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ tới thư mục `dist/`.

Bấm icon ReadFocus trên toolbar để mở viewer. Để mở PDF trên máy theo địa chỉ `file://`, bật **Cho phép truy cập URL tệp** trong trang chi tiết của extension; nếu không, hãy dùng nút **Mở PDF** hoặc kéo thả file.

### PDF trên web

- Chuột phải vào trang hoặc link PDF rồi chọn **Mở bằng ReadFocus**.
- Hoặc bấm icon ReadFocus khi đang ở tab PDF.
- Muốn mọi link `.pdf` tự mở bằng ReadFocus, bật **Tự mở PDF bằng ReadFocus** trong tab Cài đặt. Tính năng này mặc định tắt và chỉ xin quyền truy cập trang web khi bạn bật.

## Phát triển

| Lệnh | Việc |
|---|---|
| `npm run dev` | chạy dev, build ra `dist/` để load unpacked |
| `npm run build` | build production ra `dist/` |
| `npm run typecheck` | kiểm tra kiểu TypeScript |
| `npm run lint` | ESLint và kiểm tra Prettier |
| `npm test` | chạy unit test một lần |
| `npm run package` | nén `dist/` thành `release/readfocus-v<version>.zip` |
| `npm run fixtures` | tạo lại các PDF mẫu trong `tests/fixtures/` |

Các PDF mẫu (`book.pdf`, `paper.pdf`, `slides.pdf`, `scanned.pdf`, `vietnamese.pdf`) do script tự sinh, không chứa nội dung có bản quyền.

Quy trình nhánh, commit và PR: [`docs/WORKFLOW.md`](docs/WORKFLOW.md). Danh sách quyền và lý do: [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).

## Giới hạn của v0

- Chưa hỗ trợ OCR: PDF scan vẫn xem được và dùng focus mode, nhưng không có mục lục, tìm kiếm hay ước tính thời gian.
- Chỉ lập chỉ mục tối đa 100 trang mỗi lần. Tài liệu dài hơn vẫn xem bình thường; viewer sẽ hỏi khoảng trang cần lập chỉ mục.
- PDF có mật khẩu chưa mở được.
- PDF trên web khác origin có thể bị CORS chặn; khi đó hãy tải file về máy rồi mở bằng nút **Mở PDF**.
- Chưa dùng AI và chưa có bản tiếng Anh.

## Quyền riêng tư

Mọi dữ liệu được xử lý và lưu ngay trên máy. Không có analytics, telemetry hay thư viện tải từ CDN. Chi tiết ở [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Giấy phép

[MIT](LICENSE)
