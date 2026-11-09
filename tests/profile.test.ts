import { describe, expect, it } from 'vitest';
import { buildProfile, outlineDepth, type PageSample } from '../src/core/profile';

const PORTRAIT = { width: 612, height: 792 };
const LANDSCAPE = { width: 960, height: 540 };

function page(text: string, size = PORTRAIT): PageSample {
  return { text, ...size };
}

function repeat(text: string, times: number): PageSample[] {
  return Array.from({ length: times }, () => page(text));
}

describe('outlineDepth', () => {
  it('trả 0 khi không có outline', () => {
    expect(outlineDepth(null)).toBe(0);
    expect(outlineDepth([])).toBe(0);
  });

  it('tính độ sâu lớn nhất', () => {
    const items = [{ items: [{ items: [{ items: [] }] }] }, { items: [{ items: [] }] }, {}];
    expect(outlineDepth(items)).toBe(3);
  });
});

describe('buildProfile', () => {
  it('trả profile rỗng khi không có trang', () => {
    expect(buildProfile([])).toEqual({
      kind: 'unknown',
      isScanned: false,
      pageCount: 0,
      textPageRatio: 0,
      averageWordsPerPage: 0,
    });
  });

  it('nhận sách nhờ outline nhiều cấp', () => {
    const profile = buildProfile(repeat('Nội dung của một trang sách bình thường.', 5), {
      outlineDepth: 3,
    });
    expect(profile.kind).toBe('book');
  });

  it('nhận sách nhờ tiêu đề Chương', () => {
    const profile = buildProfile([page('Chương 2: Đọc hiệu quả'), ...repeat('Nội dung.', 5)]);
    expect(profile.kind).toBe('book');
  });

  it('nhận paper khi có Abstract và References', () => {
    const profile = buildProfile([
      page('Abstract: chúng tôi nghiên cứu cách đọc tài liệu nhanh hơn.'),
      ...repeat('Đây là phần thân bài với nhiều câu chữ để đủ số từ.', 8),
      page('References: Nguyễn Văn A, 2024.'),
    ]);
    expect(profile.kind).toBe('paper');
  });

  it('nhận slide khi phần lớn trang nằm ngang và ít chữ', () => {
    const profile = buildProfile([
      page('Bài giảng 1', LANDSCAPE),
      page('Ba gạch đầu dòng ngắn', LANDSCAPE),
      page('Kết luận', LANDSCAPE),
      page('Nội dung dài hơn một chút', PORTRAIT),
    ]);
    expect(profile.kind).toBe('slides');
  });

  it('trả unknown với tài liệu dọc nhiều chữ, không dấu hiệu đặc biệt', () => {
    expect(buildProfile(repeat('Nội dung thông thường của tài liệu.', 10)).kind).toBe('unknown');
  });

  it('phát hiện bản scan khi phần lớn trang không có chữ', () => {
    const profile = buildProfile([page(''), page('   '), page('Trang 3'), page('Trang 4')]);
    expect(profile.isScanned).toBe(true);
    expect(profile.textPageRatio).toBe(0);
    expect(profile.kind).toBe('unknown');
  });

  it('không coi là scan khi đa số trang có chữ', () => {
    const profile = buildProfile([
      ...repeat('Trang có nội dung chữ bình thường.', 7),
      page(''),
      page(''),
      page(''),
    ]);
    expect(profile.isScanned).toBe(false);
    expect(profile.textPageRatio).toBeCloseTo(0.7);
  });

  it('tính số từ trung bình trên trang có chữ', () => {
    const profile = buildProfile([
      page('một hai ba bốn năm'),
      page(''),
      page('sáu bảy tám chín mười một'),
    ]);
    expect(profile.averageWordsPerPage).toBe(5.5);
    expect(profile.pageCount).toBe(3);
  });
});
