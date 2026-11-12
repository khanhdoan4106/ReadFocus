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
- OCR cho PDF scan, chạy hoàn toàn trên máy (tiếng Việt và tiếng Anh): chọn khoảng trang, tiến độ, huỷ, báo trang lỗi và trang độ tin cậy thấp; mục lục, tìm kiếm, thời gian đọc và tóm tắt dùng được trên chữ nhận dạng; kết quả tìm kiếm được tô trên trang OCR.
- Tìm theo ý nghĩa (tuỳ chọn): tạo chỉ mục embeddings qua OpenAI, Gemini hoặc OpenAI-compatible, kết hợp với tìm từ khoá.
- Tab Hỏi đáp (tuỳ chọn): trả lời từ các đoạn liên quan của tài liệu, trích dẫn trang được kiểm chứng, lịch sử theo tài liệu.
- Tab Thẻ ôn tập: tạo thẻ từ bản tóm tắt hoặc bằng AI, ôn theo 5 hộp Leitner, xuất CSV cho Anki.
- Cơ sở dữ liệu IndexedDB lên phiên bản 3 (giữ nguyên dữ liệu cũ).

### Chưa có
- Embedding chạy trên máy (`@huggingface/transformers`) chưa làm vì thư viện còn chuỗi CDN mặc định trong bundle.
