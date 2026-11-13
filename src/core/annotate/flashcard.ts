import { clozeFromSentence } from '../flashcard/from-summary';
import type { CardDraft } from '../flashcard/types';
import type { Annotation } from './types';

/**
 * Nháp thẻ ôn tập từ một highlight chữ, không gọi API.
 * - Có ghi chú: mặt trước là ghi chú, mặt sau là trích dẫn.
 * - Không có ghi chú: mặt trước là câu trích dẫn đã che một từ, mặt sau là từ bị che kèm câu gốc.
 * Trả `null` khi không tạo được (highlight vùng/ghi chú trang không có chữ; câu tiếng Việt
 * không che được vì mỗi chữ chỉ là một âm tiết ngắn): giao diện nhắc người dùng thêm ghi chú.
 */
export function draftFromAnnotation(annotation: Annotation): CardDraft | null {
  if (annotation.anchor.type !== 'text') return null;
  const quote = annotation.anchor.quote.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (quote === '') return null;
  const note = annotation.note.trim();
  if (note !== '') {
    return { front: note, back: quote, page: annotation.page, source: 'note' };
  }
  const cloze = clozeFromSentence(quote);
  if (cloze === null) return null;
  return { ...cloze, page: annotation.page, source: 'note' };
}
