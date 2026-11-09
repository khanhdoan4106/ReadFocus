// Tạo các PDF fixture nhỏ, tự sinh, dùng cho việc thử phân loại tài liệu và trích văn bản.
// Chạy: node scripts/make-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'fixtures');

const PORTRAIT = { width: 612, height: 792 };
const WIDE_PORTRAIT = { width: 900, height: 1000 };
const LANDSCAPE = { width: 960, height: 540 };

const FIRST_ASCII = 0x20;
const LAST_ASCII = 0x7e;
const FIRST_FREE_CODE = 0x80;
const LAST_CODE = 0xff;
/** Mọi glyph rộng 500/1000 đơn vị, tức nửa cỡ chữ, để dòng chữ vừa trang A4. */
const GLYPH_ADVANCE = 0.5;

/** Một dòng có thể là chuỗi hoặc nhiều mẩu text nối tiếp trên cùng dòng. */
function lineChunks(line) {
  return typeof line === 'string' ? [{ text: line }] : line;
}

function pageTexts(page) {
  const texts = [];
  for (const chunk of lineChunks(page.title)) texts.push(chunk.text);
  for (const line of page.lines ?? []) {
    for (const chunk of lineChunks(line)) texts.push(chunk.text);
  }
  return texts;
}

/**
 * Gán một byte cho mỗi ký tự. ASCII giữ nguyên mã; ký tự khác (tiếng Việt có dấu)
 * nhận mã 0x80–0xFF và được ánh xạ lại bằng ToUnicode để pdf.js trích đúng chữ.
 */
function buildCharMap(pages) {
  const map = new Map();
  let next = FIRST_FREE_CODE;

  for (const page of pages) {
    for (const text of pageTexts(page)) {
      for (const char of text) {
        if (map.has(char)) continue;
        const code = char.codePointAt(0);
        if (code >= FIRST_ASCII && code <= LAST_ASCII) {
          map.set(char, code);
        } else {
          if (next > LAST_CODE) {
            throw new Error(`Fixture có quá nhiều ký tự ngoài ASCII: ${char}`);
          }
          map.set(char, next);
          next += 1;
        }
      }
    }
  }

  return map;
}

function utf16Hex(char) {
  const code = char.codePointAt(0);
  if (code <= 0xffff) return code.toString(16).padStart(4, '0').toUpperCase();

  const value = code - 0x10000;
  const high = 0xd800 + (value >> 10);
  const low = 0xdc00 + (value & 0x3ff);
  return `${high.toString(16).padStart(4, '0')}${low.toString(16).padStart(4, '0')}`.toUpperCase();
}

function toUnicodeCMap(charMap) {
  const entries = [...charMap.entries()].sort((a, b) => a[1] - b[1]);
  const lines = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo',
    '<< /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<00> <FF>',
    'endcodespacerange',
  ];

  for (let index = 0; index < entries.length; index += 100) {
    const group = entries.slice(index, index + 100);
    lines.push(`${group.length} beginbfchar`);
    for (const [char, code] of group) {
      lines.push(`<${code.toString(16).padStart(2, '0').toUpperCase()}> <${utf16Hex(char)}>`);
    }
    lines.push('endbfchar');
  }

  lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
  return lines.join('\n');
}

function encodeHex(text, charMap) {
  let hex = '';
  for (const char of text) {
    hex += charMap.get(char).toString(16).padStart(2, '0').toUpperCase();
  }
  return `<${hex}>`;
}

function formatNumber(value) {
  return Number(value.toFixed(2)).toString();
}

function pageStream(page, charMap) {
  const fontSize = page.fontSize ?? 14;
  const leading = page.leading ?? 22;
  const startX = 60;
  const lines = ['BT', `/F1 ${fontSize} Tf`];
  let y = page.height - 90;

  const emitChunk = (chunk, x) => {
    const font = chunk.font ?? 'F1';
    lines.push(`/${font} ${fontSize} Tf`);
    lines.push(`1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm`);
    lines.push(`${encodeHex(chunk.text, charMap)} Tj`);
  };

  const emitLine = (line) => {
    let x = startX;
    for (const chunk of lineChunks(line)) {
      x += chunk.gap ?? 0;
      emitChunk(chunk, x);
      x += [...chunk.text].length * fontSize * GLYPH_ADVANCE;
    }
  };

  emitLine(page.title);
  for (const line of page.lines ?? []) {
    y -= leading;
    emitLine(line);
  }

  lines.push('ET');
  return lines.join('\n');
}

function buildPdf(pages) {
  const charMap = buildCharMap(pages);
  const objects = [];
  const pageCount = pages.length;
  const firstPageObject = 3;
  const fontObject = firstPageObject + pageCount;
  const secondFontObject = fontObject + 1;
  const toUnicodeObject = fontObject + 2;
  const contentsStart = toUnicodeObject + 1;

  const kids = pages.map((_, index) => `${firstPageObject + index} 0 R`).join(' ');
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;

  pages.forEach((page, index) => {
    const contentObject = contentsStart + index;
    objects[firstPageObject + index] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
      `/Resources << /Font << /F1 ${fontObject} 0 R /F2 ${secondFontObject} 0 R >> >> ` +
      `/Contents ${contentObject} 0 R >>`;

    const stream = pageStream(page, charMap);
    objects[contentObject] =
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  // Glyph rộng 500/1000 để vị trí từng mẩu text trong fixture là xác định và dòng vừa trang.
  const widths = Array.from({ length: LAST_CODE - FIRST_ASCII + 1 }, () => 500).join(' ');
  const simpleFont = (baseFont) =>
    '<< /Type /Font /Subtype /Type1 ' +
    `/BaseFont /${baseFont} /FirstChar ${FIRST_ASCII} /LastChar ${LAST_CODE} ` +
    `/Widths [${widths}] /Encoding /WinAnsiEncoding /ToUnicode ${toUnicodeObject} 0 R >>`;
  objects[fontObject] = simpleFont('Helvetica');
  // Font thứ hai giúp các mẩu text trên cùng dòng không bị pdf.js gộp lại khi trích.
  objects[secondFontObject] = simpleFont('Times-Roman');

  const cmap = toUnicodeCMap(charMap);
  objects[toUnicodeObject] =
    `<< /Length ${Buffer.byteLength(cmap, 'latin1')} >>\nstream\n${cmap}\nendstream`;

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let index = 1; index <= objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

function portraitPage(title, lines, extra = {}) {
  return { ...PORTRAIT, title, lines, ...extra };
}

const bodyLines = [
  'This paragraph exists so the page has enough words to count as a text page.',
  'The text also makes the fixture useful when checking word counts and estimates.',
  'Every fixture is generated locally and contains no copyrighted material.',
];

const fixtures = {
  'book.pdf': buildPdf([
    portraitPage('Chapter 1', ['Reading faster', ...bodyLines], { fontSize: 24 }),
    portraitPage('Contents', ['Chapter 1 ........ 1', 'Chapter 2 ........ 2']),
    portraitPage('Reading faster', bodyLines),
    portraitPage('Chapter 2', ['Staying focused', ...bodyLines], { fontSize: 24 }),
    portraitPage('Staying focused', bodyLines),
    portraitPage('Chapter 3', ['Review', ...bodyLines], { fontSize: 24 }),
    portraitPage('Review', bodyLines),
  ]),
  'paper.pdf': buildPdf([
    portraitPage('A small study of reading speed', ['Abstract', ...bodyLines], {
      fontSize: 20,
    }),
    portraitPage('Introduction', bodyLines),
    portraitPage('Method', bodyLines),
    portraitPage('Results', bodyLines),
    portraitPage('Discussion', bodyLines),
    portraitPage('References', ['Nguyen, A. 2024. Reading on screen.']),
  ]),
  'slides.pdf': buildPdf([
    {
      ...LANDSCAPE,
      title: 'Lecture 1',
      lines: ['Three short bullets', 'No long paragraphs'],
      fontSize: 28,
    },
    { ...LANDSCAPE, title: 'Why read faster', lines: ['Attention is limited'], fontSize: 28 },
    { ...LANDSCAPE, title: 'Practice', lines: ['Skim', 'Scan', 'Focus'], fontSize: 28 },
    { ...LANDSCAPE, title: 'Summary', lines: ['Read with intent'], fontSize: 28 },
  ]),
  // Tiếng Việt có dấu, nhiều dòng được chia thành nhiều mẩu text trên cùng một dòng.
  // Đổi font giữa các mẩu để pdf.js không gộp chúng lại khi trích văn bản.
  'vietnamese.pdf': buildPdf([
    {
      ...WIDE_PORTRAIT,
      title: [
        { text: 'Chương', font: 'F1' },
        { text: 'một', gap: 8, font: 'F2' },
      ],
      fontSize: 24,
      lines: [
        [
          { text: 'Đọc', font: 'F1' },
          { text: 'nhanh', gap: 7, font: 'F2' },
          { text: 'và', gap: 7, font: 'F1' },
          { text: 'tập', gap: 7, font: 'F2' },
          { text: 'trung', gap: 7, font: 'F1' },
          { text: 'hơn', gap: 7, font: 'F2' },
        ],
        'Tài liệu tiếng Việt có dấu.',
      ],
    },
    {
      ...WIDE_PORTRAIT,
      title: [
        { text: 'Chư', font: 'F1' },
        { text: 'ơng', gap: 0, font: 'F2' },
        { text: 'hai', gap: 8, font: 'F1' },
      ],
      fontSize: 24,
      lines: ['Tìm không dấu khớp chữ có dấu.', 'Dòng này có nhiều mẩu nối tiếp.'],
    },
    {
      ...PORTRAIT,
      title: 'Kết luận',
      lines: ['Đọc nhanh nhờ mục lục và thời gian.'],
    },
  ]),
  'scanned.pdf': buildPdf([
    { ...PORTRAIT, title: '', lines: [] },
    { ...PORTRAIT, title: '', lines: [] },
    { ...PORTRAIT, title: '', lines: [] },
    { ...PORTRAIT, title: '', lines: [] },
  ]),
};

mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(join(outDir, name), data);
}

const pages = Object.fromEntries(
  Object.entries(fixtures).map(([name, data]) => [name, data.length]),
);
console.log(`Đã tạo fixture trong ${outDir}:`, pages);
