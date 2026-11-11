import { describe, expect, it } from 'vitest';
import {
  filterSummarizableSections,
  findSummaryForSection,
  formatSummaryClipboard,
  hasSummaryForSection,
  SUMMARY_MAX_PAGE,
} from '../src/core/summarize/format';
import type { SummaryRecord } from '../src/core/summarize/record';
import type { TocItem } from '../src/storage/db';

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

describe('filterSummarizableSections', () => {
  const items: TocItem[] = [
    { title: 'Phần 1', startPage: 1, endPage: 40, level: 1, wordCount: 5000 },
    { title: 'Phần 2', startPage: 41, endPage: 90, level: 1, wordCount: 6000 },
    { title: 'Phần 3', startPage: 91, endPage: 120, level: 1, wordCount: 4000 },
    { title: 'Phần 4', startPage: 121, endPage: 150, level: 1, wordCount: 3000 },
  ];

  it('chỉ lấy các mục có startPage <= 100 và kẹp endPage tối đa 100', () => {
    const filtered = filterSummarizableSections(items);
    expect(filtered).toHaveLength(3);
    expect(filtered[0]?.title).toBe('Phần 1');
    expect(filtered[0]?.endPage).toBe(40);
    expect(filtered[1]?.title).toBe('Phần 2');
    expect(filtered[1]?.endPage).toBe(90);
    expect(filtered[2]?.title).toBe('Phần 3');
    expect(filtered[2]?.endPage).toBe(SUMMARY_MAX_PAGE);
  });
});

describe('hasSummaryForSection & findSummaryForSection', () => {
  const summaries = [sampleRecord];

  it('kiểm tra và tìm bản tóm tắt khớp khoảng trang', () => {
    expect(hasSummaryForSection(summaries, { startPage: 1, endPage: 5 })).toBe(true);
    expect(hasSummaryForSection(summaries, { startPage: 6, endPage: 10 })).toBe(false);

    expect(findSummaryForSection(summaries, { startPage: 1, endPage: 5 })).toBe(sampleRecord);
    expect(findSummaryForSection(summaries, { startPage: 6, endPage: 10 })).toBeUndefined();
  });
});

