// Tạo các PDF fixture nhỏ, tự sinh, dùng cho việc thử phân loại tài liệu và trích văn bản.
// Chạy: node scripts/make-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'fixtures');

const PORTRAIT = { width: 612, height: 792 };
const LANDSCAPE = { width: 960, height: 540 };

function escapeText(text) {
  return text.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, (character) => `\\${character}`);
}

function pageStream(page) {
  const lines = [`BT`, `/F1 ${page.fontSize ?? 14} Tf`, `60 ${page.height - 90} Td`];
  lines.push(`(${escapeText(page.title)}) Tj`);

  for (const line of page.lines ?? []) {
    lines.push(`0 -${page.leading ?? 22} Td`, `(${escapeText(line)}) Tj`);
  }
  lines.push('ET');
  return lines.join('\n');
}

function buildPdf(pages) {
  const objects = [];
  const pageCount = pages.length;
  const firstPageObject = 3;
  const fontObject = firstPageObject + pageCount;
  const contentsStart = fontObject + 1;

  const kids = pages.map((_, index) => `${firstPageObject + index} 0 R`).join(' ');
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;

  pages.forEach((page, index) => {
    const contentObject = contentsStart + index;
    objects[firstPageObject + index] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
      `/Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;

    const stream = pageStream(page);
    objects[contentObject] =
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

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
