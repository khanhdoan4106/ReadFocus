# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/).

## [Unreleased]

### Thêm
- Khung dự án, quy trình làm việc và CI.
- Tóm tắt bằng AI (tuỳ chọn, người dùng tự nhập key): OpenAI, Google Gemini, Anthropic và OpenAI-compatible (Ollama, LM Studio).
- Cài đặt → AI: chọn nhà cung cấp và model, kiểm tra kết nối, tuỳ chọn không lưu key, xoá key, hộp xác nhận gửi dữ liệu lần đầu, xin quyền truy cập đúng địa chỉ API khi cần.
- Tab Tóm tắt: tóm tắt từng mục (mục dài chạy map-reduce), ý chính có số trang bấm được, thuật ngữ, tạo lại, sao chép, huỷ; kết quả lưu cache trên máy.
- Tóm tắt toàn bộ tài liệu (tối đa 100 trang): ước lượng request/token, xác nhận trước khi chạy, tối đa 2 request song song, có tiến độ.
- Tab Mục lục đánh dấu mục đã có tóm tắt; lỗi AI có thông báo tiếng Việt nói rõ cần làm gì.
- Tài liệu: phần AI trong README và `docs/PRIVACY.md` (dữ liệu gửi đi, nơi lưu key, cách xoá).
