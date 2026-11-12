import { textHash } from '../embed/chunk';
import type { SummaryRecord } from '../summarize/record';
import { addDays } from './leitner';
import type { Card, CardDraft } from './types';

export const BLANK = '_____';
const MIN_BLANK_WORD = 5;

/** Từ dài nhất (chỉ chữ cái) làm chỗ trống; câu không có từ đủ dài thì không tạo thẻ. */
export function pickBlankWord(sentence: string): string | null {
  const words = sentence.match(/[\p{L}]+/gu) ?? [];
  let best: string | null = null;
  for (const word of words) {
    if (word.length >= MIN_BLANK_WORD && (best === null || word.length > best.length)) best = word;
  }
  return best;
}

/** Thẻ điền chỗ trống từ một ý chính: mặt trước là câu đã che, mặt sau là từ cần điền và câu đầy đủ. */
export function clozeFromSentence(sentence: string): { front: string; back: string } | null {
  const text = sentence.replace(/\s+/g, ' ').trim();
  const word = pickBlankWord(text);
  if (word === null) return null;
  return { front: text.replace(word, BLANK), back: `${word}\n\n${text}` };
}

/** Thẻ miễn phí, không gọi API: thuật ngữ → định nghĩa, ý chính → điền chỗ trống. */
export function draftsFromSummary(record: SummaryRecord): CardDraft[] {
  const drafts: CardDraft[] = [];
  for (const term of record.terms) {
    const front = term.term.trim();
    const back = term.definition.trim();
    if (front !== '' && back !== '') {
      drafts.push({ front, back, page: record.startPage, source: 'summary' });
    }
  }
  for (const point of record.keyPoints) {
    const cloze = clozeFromSentence(point.text);
    if (cloze === null) continue;
    const page = point.pages.find((p) => p >= record.startPage && p <= record.endPage);
    drafts.push({ ...cloze, page: page ?? record.startPage, source: 'summary' });
  }
  return drafts;
}

/** Id theo nội dung: tạo lại từ cùng một tóm tắt không nhân đôi thẻ và không xoá tiến độ ôn. */
export function cardId(docId: string, draft: Pick<CardDraft, 'front' | 'back' | 'source'>): string {
  return `${docId}|${draft.source}|${textHash(`${draft.front}\u0000${draft.back}`)}`;
}

export function newCard(docId: string, draft: CardDraft, today: string, now: number): Card {
  return {
    id: cardId(docId, draft),
    docId,
    front: draft.front,
    back: draft.back,
    page: draft.page,
    source: draft.source,
    box: 1,
    dueDate: addDays(today, 0),
    createdAt: now,
  };
}

/** Thẻ mới chưa có trong danh sách hiện tại (theo id), không trùng nhau. */
export function freshCards(
  docId: string,
  drafts: readonly CardDraft[],
  existing: readonly Card[],
  today: string,
  now: number,
): Card[] {
  const seen = new Set(existing.map((card) => card.id));
  const result: Card[] = [];
  for (const draft of drafts) {
    const card = newCard(docId, draft, today, now);
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}
