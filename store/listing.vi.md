# Hồ sơ Chrome Web Store — tiếng Việt

Nội dung để dán vào Developer Dashboard → Store listing (ngôn ngữ Vietnamese). Không có gì được tải lên tự động.

## Tên

ReadFocus

(Lấy từ `__MSG_extName__` trong manifest.)

## Mô tả ngắn (từ `description` của manifest, tối đa 132 ký tự)

Đọc PDF dễ chịu hơn: mục lục tự động, tìm kiếm, ước tính thời gian đọc và chế độ tập trung.

(91 ký tự. Đây là `extDescription` trong `public/_locales/vi/messages.json`.)

## Danh mục

Productivity (Năng suất). Kiểm tra lại tên danh mục và danh mục con trong danh sách thả xuống của dashboard; tài liệu không liệt kê.

## Mô tả chi tiết

ReadFocus là trình đọc PDF cho sách, bài báo và slide bài giảng. Nó mở PDF trong tab riêng, giúp bạn biết còn bao nhiêu phải đọc, tìm nhanh điều cần tìm và giữ sự chú ý vào dòng đang đọc.

Đọc
• Mục lục tự động, dựng từ đề mục và bookmark của PDF
• Thời gian còn lại của mục và của cả tài liệu, tính theo tốc độ đọc của bạn
• Tìm kiếm hiểu tiếng Việt: gõ "chuong" vẫn thấy "chương"
• Nhớ trang bạn đang đọc ở từng tài liệu
• Giao diện sáng, tối hoặc theo hệ thống; tiếng Việt hoặc English

Giữ tập trung
• Hẹn giờ đọc theo chương và Pomodoro, có thông báo khi hết giờ
• Chế độ tập trung: làm mờ trang, chỉ giữ một dải sáng đi theo chuột hoặc phím ↑ ↓
• Thống kê phút và trang đọc mỗi ngày, lưu ngay trên máy

PDF scan
• Nhận dạng chữ (OCR) tiếng Việt và tiếng Anh chạy ngay trên máy, để trang scan tìm kiếm được. Chữ nhận dạng có thể sai; trang có nhãn "OCR".

AI tuỳ chọn (tắt cho đến khi bạn tự cấu hình)
• Tóm tắt một mục hoặc cả tài liệu, ý chính có số trang để nhảy tới
• Tìm theo ý nghĩa, và hỏi đáp về tài liệu với câu trả lời trích đúng trang
• Thẻ ôn tập từ bản tóm tắt, có lịch ôn đơn giản và xuất CSV cho Anki
• Bạn dùng API key của chính mình (OpenAI, Google Gemini, Anthropic, hoặc server OpenAI-compatible như Ollama, LM Studio chạy trên máy bạn). Nội dung chỉ được gửi khi bạn bấm nút, chỉ tới nhà cung cấp bạn chọn và không qua máy chủ của ReadFocus.

Riêng tư
• Không tài khoản, không analytics, không quảng cáo, không tải mã từ xa
• Tài liệu và dữ liệu đọc nằm trong bộ nhớ của trình duyệt trên máy bạn
• Chrome chỉ hỏi quyền truy cập trang web khi bạn bật "Tự mở PDF", và quyền tới địa chỉ nhà cung cấp AI khi bạn dùng AI

Mở PDF bằng nút trên thanh công cụ, kéo thả file vào, hoặc từ trang web bằng chuột phải → "Mở bằng ReadFocus". Mở file trên máy (file://) cần bật "Allow access to file URLs" trong chrome://extensions.

## Chú thích ảnh chụp (tuỳ chọn)

Ảnh nằm ở `store/screenshots/vi/`.

1. 01-reading-toc: "Mục lục và thời gian còn lại cho mọi PDF"
2. 02-search: "Tìm kiếm trong cả tài liệu"
3. 03-summary: "Tóm tắt AI tuỳ chọn, có số trang (kết quả minh hoạ)"
4. 04-focus-mode: "Chế độ tập trung giữ dải sáng trên dòng đang đọc"
5. 05-ocr: "OCR trên máy cho trang scan"

Chữ AI trong ảnh 3 là kết quả minh hoạ, không phải câu trả lời của model thật; giữ "(kết quả minh hoạ)" trong chú thích.

## Liên kết

- Chính sách quyền riêng tư: `https://github.com/khanhdoan4106/ReadFocus/blob/main/docs/PRIVACY.md` (dùng được sau khi nhánh này được merge; bản tiếng Anh là `docs/PRIVACY.en.md`). Store thường cần chính sách bằng tiếng Anh, nên điền bản `.en.md` cho listing chính.
- Hỗ trợ / trang chủ: repo `https://github.com/khanhdoan4106/ReadFocus`
