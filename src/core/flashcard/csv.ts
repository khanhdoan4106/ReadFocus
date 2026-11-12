import type { Card } from './types';

/** Một ô CSV: luôn đặt trong ngoặc kép, nhân đôi ngoặc kép bên trong; giữ nguyên xuống dòng. */
export function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Tag của Anki không chấp nhận khoảng trắng. */
export function ankiTag(value: string): string {
  const tag = value
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, '_')
    .replace(/[",]/g, '');
  return tag === '' ? 'ReadFocus' : tag;
}

/**
 * CSV nhập được vào Anki: front, back, tag (tên tài liệu và trang). Các dòng `#`
 * đầu file là chỉ thị của Anki (phân cách, không HTML, cột tag).
 */
export function cardsToAnkiCsv(cards: readonly Card[], documentName: string): string {
  const base = ankiTag(documentName);
  const lines = ['#separator:comma', '#html:false', '#tags column:3'];
  for (const card of cards) {
    lines.push(
      [csvField(card.front), csvField(card.back), csvField(`${base} trang_${card.page}`)].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
