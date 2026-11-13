import { describe, expect, it } from 'vitest';
import {
  EXPORT_SCHEMA,
  EXPORT_VERSION,
  exportAnnotationsJson,
  exportAnnotationsMarkdown,
  mergeAnnotations,
  parseAnnotationsJson,
  type MarkdownLabels,
} from '../src/core/annotate/exchange';
import {
  createAnnotation,
  sanitizeAnnotation,
  updateAnnotation,
} from '../src/core/annotate/record';
import type { Annotation } from '../src/core/annotate/types';

const DOC = { id: 'doc-1', name: 'sach.pdf', pageCount: 10 };
const RECT = { x: 0.1, y: 0.2, w: 0.3, h: 0.02 };

function sample(): Annotation[] {
  let n = 0;
  const env = { now: () => 1000 + n, uuid: () => `id-${(n += 1)}` };
  return [
    createAnnotation(
      {
        docId: DOC.id,
        page: 3,
        color: 'green',
        note: 'Ý chính',
        anchor: {
          type: 'text',
          start: 5,
          end: 20,
          quote: 'Xác suất đo mức độ',
          prefix: 'abc ',
          suffix: ' def',
          rects: [RECT],
        },
      },
      env,
    ),
    createAnnotation(
      { docId: DOC.id, page: 1, anchor: { type: 'page' }, note: 'Đọc lại trang này' },
      env,
    ),
    createAnnotation(
      { docId: DOC.id, page: 3, color: 'pink', anchor: { type: 'area', rect: RECT } },
      env,
    ),
  ];
}

describe('sanitizeAnnotation', () => {
  it('nhận bản ghi hợp lệ cho cả ba loại', () => {
    for (const item of sample()) expect(sanitizeAnnotation(item)).toEqual(item);
  });

  it.each([
    ['null', null],
    ['thiếu id', { ...sample()[0], id: '' }],
    ['trang 0', { ...sample()[0], page: 0 }],
    ['màu lạ', { ...sample()[0], color: 'red' }],
    ['kind khác neo', { ...sample()[0], kind: 'area' }],
    ['rect ngoài 0..1', { ...sample()[2], anchor: { type: 'area', rect: { ...RECT, w: 3 } } }],
    ['end <= start', { ...sample()[0], anchor: { ...sample()[0]?.anchor, start: 9, end: 9 } }],
    ['note không phải chuỗi', { ...sample()[0], note: 5 }],
  ])('từ chối bản ghi hỏng: %s', (_name, raw) => {
    expect(sanitizeAnnotation(raw)).toBeNull();
  });
});

describe('updateAnnotation', () => {
  it('đổi màu và ghi chú, updatedAt luôn tăng dù đồng hồ lùi', () => {
    const [item] = sample() as [Annotation];
    const next = updateAnnotation(item, { color: 'blue', note: 'mới' }, () => 1);
    expect(next).toMatchObject({ color: 'blue', note: 'mới', id: item.id });
    expect(next.updatedAt).toBe(item.updatedAt + 1);
    expect(next.createdAt).toBe(item.createdAt);
  });
});

describe('xuất và nhập JSON', () => {
  it('vòng đi vòng lại giữ nguyên dữ liệu, có schema và version', () => {
    const items = sample();
    const json = exportAnnotationsJson(DOC, items, 5);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.schema).toBe(EXPORT_SCHEMA);
    expect(parsed.version).toBe(EXPORT_VERSION);
    const back = parseAnnotationsJson(json, DOC.id);
    expect(back).toEqual({ ok: true, document: DOC, annotations: items });
  });

  it('chỉ xuất ghi chú của đúng tài liệu', () => {
    const other = createAnnotation({ docId: 'doc-2', page: 1, anchor: { type: 'page' } });
    const parsed = parseAnnotationsJson(exportAnnotationsJson(DOC, [...sample(), other]));
    expect(parsed.ok && parsed.annotations.length).toBe(3);
  });

  it.each([
    ['không phải JSON', '{oops', 'invalid-json'],
    ['sai schema', JSON.stringify({ schema: 'khac', version: 1 }), 'wrong-schema'],
    ['mảng thay vì object', '[]', 'wrong-schema'],
    ['sai version', JSON.stringify({ schema: EXPORT_SCHEMA, version: 99 }), 'wrong-version'],
    [
      'thiếu document',
      JSON.stringify({ schema: EXPORT_SCHEMA, version: EXPORT_VERSION, annotations: [] }),
      'invalid-data',
    ],
  ])('báo rõ: %s', (_name, text, error) => {
    expect(parseAnnotationsJson(text)).toEqual({ ok: false, error });
  });

  it('một bản ghi hỏng thì từ chối cả file (không nhập dở dang)', () => {
    const file = JSON.parse(exportAnnotationsJson(DOC, sample())) as { annotations: unknown[] };
    file.annotations.push({ id: 'x' });
    expect(parseAnnotationsJson(JSON.stringify(file))).toEqual({
      ok: false,
      error: 'invalid-data',
    });
  });

  it('bản ghi thuộc tài liệu khác với document của file là dữ liệu hỏng', () => {
    const file = JSON.parse(exportAnnotationsJson(DOC, sample())) as { annotations: Annotation[] };
    file.annotations[0] = { ...(file.annotations[0] as Annotation), docId: 'doc-khac' };
    expect(parseAnnotationsJson(JSON.stringify(file))).toEqual({
      ok: false,
      error: 'invalid-data',
    });
  });

  it('file của tài liệu khác với tài liệu đang mở bị chặn', () => {
    const json = exportAnnotationsJson(DOC, sample());
    expect(parseAnnotationsJson(json, 'doc-khac')).toEqual({ ok: false, error: 'other-document' });
  });
});

describe('mergeAnnotations', () => {
  it('thêm bản mới, giữ bản có updatedAt mới hơn, bằng nhau thì giữ bản đang có', () => {
    const [a, b, c] = sample() as [Annotation, Annotation, Annotation];
    const newerA = { ...a, note: 'sửa ở máy kia', updatedAt: a.updatedAt + 10 };
    const olderB = { ...b, note: 'cũ hơn', updatedAt: b.updatedAt - 1 };
    const sameC = { ...c, note: 'cùng thời điểm' };
    const fresh = createAnnotation({ docId: DOC.id, page: 7, anchor: { type: 'page' } });

    const result = mergeAnnotations([a, b, c], [newerA, olderB, sameC, fresh]);
    expect(result).toMatchObject({ added: 1, updated: 1, unchanged: 2 });
    expect(result.toWrite.map((x) => x.id).sort()).toEqual([a.id, fresh.id].sort());
    const byId = new Map(result.merged.map((x) => [x.id, x]));
    expect(byId.get(a.id)?.note).toBe('sửa ở máy kia');
    expect(byId.get(b.id)?.note).toBe(b.note);
    expect(byId.get(c.id)?.note).toBe(c.note);
    expect(result.merged).toHaveLength(4);
  });

  it('nhập hai lần cùng một file không đổi gì (idempotent)', () => {
    const items = sample();
    const once = mergeAnnotations([], items);
    const twice = mergeAnnotations(once.merged, items);
    expect(twice.toWrite).toEqual([]);
    expect(twice.merged).toHaveLength(3);
  });
});

describe('xuất Markdown', () => {
  const labels: MarkdownLabels = {
    pageHeading: (page) => `Trang ${page}`,
    pageNote: 'Ghi chú trang',
    area: 'Vùng đã đánh dấu',
    note: 'Ghi chú',
    color: 'Màu',
    colors: { yellow: 'Vàng', green: 'Xanh lá', blue: 'Xanh dương', pink: 'Hồng' },
  };

  it('có tiêu đề, nhóm theo trang tăng dần, blockquote, ghi chú và màu', () => {
    const md = exportAnnotationsMarkdown('Sách xác suất', sample(), labels);
    expect(md.startsWith('# Sách xác suất\n')).toBe(true);
    expect(md.indexOf('## Trang 1')).toBeLessThan(md.indexOf('## Trang 3'));
    expect(md.match(/## Trang 3/g)).toHaveLength(1);
    expect(md).toContain('> Xác suất đo mức độ');
    expect(md).toContain('Ghi chú: Ý chính');
    expect(md).toContain('_Màu: Xanh lá_');
    expect(md).toContain('_Ghi chú trang_');
    expect(md).toContain('_Vùng đã đánh dấu_');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('quote nhiều dòng: mọi dòng đều có dấu >', () => {
    const [first] = sample() as [Annotation];
    const multi: Annotation = {
      ...first,
      anchor: {
        ...(first.anchor as Extract<Annotation['anchor'], { type: 'text' }>),
        quote: 'dòng một\n\ndòng ba',
      },
    };
    const md = exportAnnotationsMarkdown('T', [multi], labels);
    expect(md).toContain('> dòng một\n>\n> dòng ba');
  });
});
