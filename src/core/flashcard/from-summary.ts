import { textHash } from '../embed/chunk';
import type { SummaryRecord } from '../summarize/record';
import { looksVietnamese } from '../summarize/tokens';
import { addDays } from './leitner';
import type { Card, CardDraft } from './types';

export const BLANK = '_____';
const MIN_BLANK_WORD = 5;

/** Ký tự thuộc một từ: chữ, số và dấu kết hợp. */
const WORD_CHAR = String.raw`[\p{L}\p{N}\p{M}]`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Tìm lần xuất hiện đầu tiên của cụm từ nguyên vẹn (không khớp giữa chừng một từ, không phân biệt hoa thường). */
function findWhole(text: string, phrase: string): RegExpExecArray | null {
  const parts = phrase.split(/\s+/u).filter((part) => part !== '');
  if (parts.length === 0) return null;
  const body = parts.map(escapeRegExp).join(String.raw`\s+`);
  return new RegExp(`(?<!${WORD_CHAR})${body}(?!${WORD_CHAR})`, 'iu').exec(text);
}

/** Từ dài nhất (chỉ chữ cái) làm chỗ trống; câu không có từ đủ dài thì trả `null`. */
export function pickBlankWord(sentence: string): string | null {
  const words = sentence.match(/[\p{L}]+/gu) ?? [];
  let best: string | null = null;
  for (const word of words) {
    if (word.length >= MIN_BLANK_WORD && (best === null || word.length > best.length)) best = word;
  }
  return best;
}

function blankAt(text: string, match: RegExpExecArray): { front: string; back: string } {
  const answer = match[0];
  const front = `${text.slice(0, match.index)}${BLANK}${text.slice(match.index + answer.length)}`;
  return { front, back: `${answer}\n\n${text}` };
}

/**
 * Thẻ điền chỗ trống từ một ý chính. Ưu tiên che thuật ngữ của chính tóm tắt
 * xuất hiện nguyên cụm trong câu (chọn thuật ngữ dài nhất, chỉ che lần đầu). Không có
 * thuật ngữ nào khớp thì: văn bản tiếng Việt bị bỏ qua (mỗi chữ chỉ là một âm
 * tiết ngắn, che từ dài nhất thường vô nghĩa); văn bản khác che từ nguyên vẹn dài nhất.
 */
export function clozeFromSentence(
  sentence: string,
  terms: readonly string[] = [],
): { front: string; back: string } | null {
  const text = sentence.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (text === '') return null;

  const candidates = terms
    .map((term) => term.normalize('NFC').replace(/\s+/g, ' ').trim())
    .filter((term) => term !== '')
    .sort((a, b) => b.length - a.length);
  for (const term of candidates) {
    const match = findWhole(text, term);
    if (match !== null) return blankAt(text, match);
  }

  if (looksVietnamese(text)) return null;
  const word = pickBlankWord(text);
  if (word === null) return null;
  const match = findWhole(text, word);
  return match === null ? null : blankAt(text, match);
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
    const cloze = clozeFromSentence(
      point.text,
      record.terms.map((term) => term.term),
    );
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
