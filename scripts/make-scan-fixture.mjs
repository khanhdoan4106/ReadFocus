// Tạo PDF "scan" tiếng Việt nhỏ để thử tay OCR: chữ được vẽ ra ảnh JPEG rồi nhúng
// vào PDF, hoàn toàn không có lớp chữ. Không chứa nội dung có bản quyền.
// Chạy: node scripts/make-scan-fixture.mjs
// Cần @napi-rs/canvas và một font hệ thống có tiếng Việt (Arial/DejaVu Sans...).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'fixtures');

/** Khổ trang PDF (điểm) và ảnh (~150 dpi) để chữ đủ nét cho OCR. */
const PAGE = { width: 595, height: 842 };
const IMAGE = { width: 1240, height: 1754 };

const PAGES = [
  {
    title: 'Chương 1: Giới thiệu',
    lines: [
      'Đây là bản scan thử nghiệm của ReadFocus.',
      'Văn bản tiếng Việt có dấu được vẽ thành ảnh,',
      'nên trang này không có lớp chữ trong PDF.',
      'Nhận dạng chữ giúp tìm kiếm và tóm tắt được.',
    ],
  },
  {
    title: 'Chương 2: Phương pháp',
    lines: [
      'Chúng tôi dùng bộ nhận dạng chạy ngay trên máy.',
      'Kết quả có thể sai với trang mờ hoặc chữ nhỏ.',
      'Hãy đối chiếu với trang gốc khi cần độ chính xác.',
    ],
  },
  {
    title: 'Chương 3: Kết luận',
    lines: [
      'Từ khoá để thử tìm kiếm: nhận dạng, tiếng Việt.',
      'Trang cuối của bản scan thử nghiệm.',
    ],
  },
];

function drawPage(page) {
  const canvas = createCanvas(IMAGE.width, IMAGE.height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, IMAGE.width, IMAGE.height);
  context.fillStyle = '#111111';
  context.textBaseline = 'top';

  context.font = 'bold 64px Arial, "DejaVu Sans", sans-serif';
  context.fillText(page.title, 120, 160);

  context.font = '40px Arial, "DejaVu Sans", sans-serif';
  page.lines.forEach((line, index) => {
    context.fillText(line, 120, 320 + index * 80);
  });
  return canvas.toBuffer('image/jpeg', 90);
}

const encoder = new TextEncoder();

function buildScanPdf(jpegs) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = add('PLACEHOLDER');
  const pageIds = [];

  for (const jpeg of jpegs) {
    const imageId = add({
      dict: `<< /Type /XObject /Subtype /Image /Width ${IMAGE.width} /Height ${IMAGE.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
      stream: jpeg,
    });
    const content = `q ${PAGE.width} 0 0 ${PAGE.height} 0 0 cm /Im0 Do Q`;
    const contentId = add({
      dict: `<< /Length ${content.length} >>`,
      stream: encoder.encode(content),
    });
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const chunks = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const offsets = [];

  push('%PDF-1.4\n');
  objects.forEach((object, index) => {
    offsets.push(length);
    push(`${index + 1} 0 obj\n`);
    if (typeof object === 'string') {
      push(object);
    } else {
      push(`${object.dict}\nstream\n`);
      push(object.stream);
      push('\nendstream');
    }
    push('\nendobj\n');
  });

  const xrefStart = length;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  push(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const output = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return output;
}

mkdirSync(outDir, { recursive: true });
const pdf = buildScanPdf(PAGES.map(drawPage));
writeFileSync(join(outDir, 'scanned-vi.pdf'), pdf);
console.log(`Đã tạo ${join(outDir, 'scanned-vi.pdf')} (${pdf.length} byte, ${PAGES.length} trang)`);
