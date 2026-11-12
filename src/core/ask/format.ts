import type { QaRecord } from './types';

/** Văn bản thuần để sao chép: câu hỏi, câu trả lời và các trích dẫn đã kiểm chứng. */
export function formatQaClipboard(
  record: Pick<QaRecord, 'question' | 'answer' | 'citations'>,
  labels: { question: string; answer: string; citations: string; page: (page: number) => string },
): string {
  const lines = [
    `${labels.question}: ${record.question}`,
    '',
    `${labels.answer}: ${record.answer}`,
  ];
  if (record.citations.length > 0) {
    lines.push('', `${labels.citations}:`);
    for (const citation of record.citations) {
      lines.push(`- ${labels.page(citation.page)}: “${citation.quote}”`);
    }
  }
  return lines.join('\n');
}
