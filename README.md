# ReadFocus

Extension Chrome giúp đọc PDF nhanh và tập trung hơn: mục lục tự động, tìm kiếm, ước tính thời gian đọc từng chương, hẹn giờ và focus mode. Dùng được cho sách, paper và slide bài giảng.

> 🚧 Đang phát triển bản v0. Xem kế hoạch ở [`docs/PLAN.md`](docs/PLAN.md).

## Quyền riêng tư

Bản v0 xử lý mọi thứ ngay trên máy bạn. Tài liệu không được gửi đi đâu, không có analytics hay telemetry.

## Cài đặt từ mã nguồn

Cần Node 22.

```bash
npm ci
npm run build
```

Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ tới thư mục `dist/`.

## Phát triển

| Lệnh | Việc |
|---|---|
| `npm run dev` | chạy dev |
| `npm run typecheck` | kiểm tra kiểu |
| `npm run lint` | ESLint + Prettier |
| `npm test` | chạy test |
| `npm run package` | đóng gói file zip vào `release/` |

Quy trình nhánh, PR và phát hành: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Giấy phép

[MIT](LICENSE)
