import { describe, expect, it } from 'vitest';
import { formatSummaryClipboard } from '../src/core/summarize/format';
import type { SummaryRecord } from '../src/core/summarize/record';

const sampleRecord: SummaryRecord = {
  id: 'key-1',
  docId: 'doc-1',
  startPage: 1,
  endPage: 5,
  title: 'Chương 1: Giới thiệu',
  providerId: 'openai',
  model: 'gpt-4o-mini',
  promptVersion: 1,
  language: 'vi',
  summary: 'Đây là tóm tắt nội dung chương 1.',
  keyPoints: [
    { text: 'Khái niệm cơ bản', pages: [1, 2] },
    { text: 'Mục tiêu nghiên cứu', pages: [3] },
  ],
  terms: [{ term: 'AI', definition: 'Trí tuệ nhân tạo' }],
  createdAt: 1700000000000,
};

describe('formatSummaryClipboard', () => {
  it('định dạng đầy đủ tiêu đề, tóm tắt, ý chính và thuật ngữ', () => {
    const text = formatSummaryClipboard(sampleRecord);
    expect(text).toContain('Chương 1: Giới thiệu');
    expect(text).toContain('Đây là tóm tắt nội dung chương 1.');
    expect(text).toContain('Ý chính:');
    expect(text).toContain('- Khái niệm cơ bản (Trang 1, 2)');
    expect(text).toContain('- Mục tiêu nghiên cứu (Trang 3)');
    expect(text).toContain('Thuật ngữ:');
    expect(text).toContain('- AI: Trí tuệ nhân tạo');
  });

  it('xử lý bản ghi không có keyPoints hoặc terms', () => {
    const minimal: SummaryRecord = {
      ...sampleRecord,
      title: '',
      keyPoints: [],
      terms: [],
    };
    const text = formatSummaryClipboard(minimal);
    expect(text).toBe('Đây là tóm tắt nội dung chương 1.');
    expect(text).not.toContain('Ý chính:');
    expect(text).not.toContain('Thuật ngữ:');
  });
});
