import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { parseLanguagePreference, resolveLocale } from '../src/i18n';
import { vi } from '../src/i18n/vi';

type Node = unknown;

function flatten(value: Node, prefix = ''): Map<string, Node> {
  const out = new Map<string, Node>();
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of flatten(child, `${prefix}${key}.`)) out.set(path, leaf);
    }
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => {
      for (const [path, leaf] of flatten(child, `${prefix}${index}.`)) out.set(path, leaf);
    });
  } else {
    out.set(prefix.slice(0, -1), value);
  }
  return out;
}

const viFlat = flatten(vi);
const enFlat = flatten(en);

/** Gọi hàm chữ với tham số đánh dấu để xem tham số nào được chèn vào kết quả. */
function probe(fn: (...args: never[]) => unknown): string[] {
  const numbers = [11, 22, 33, 44];
  const strings = ['AAA', 'BBB', 'CCC', 'DDD'];
  const calls: unknown[][] = [];
  // Tham số kiểu số hoặc chuỗi: thử hai cách gán và gộp kết quả.
  calls.push(numbers.slice(0, fn.length));
  calls.push(strings.slice(0, fn.length));
  calls.push([true]);
  calls.push([false]);
  calls.push(['AAA', 22, 'CCC', 44].slice(0, fn.length));
  const results: string[] = [];
  for (const args of calls) {
    try {
      results.push(String((fn as (...a: unknown[]) => unknown)(...args)));
    } catch {
      // bỏ qua cách gán không hợp
    }
  }
  return results;
}

function markers(text: string): Set<string> {
  return new Set(text.match(/AAA|BBB|CCC|DDD|\b(?:11|22|33|44)\b/g) ?? []);
}

describe('i18n: vi và en', () => {
  it('có cùng bộ khoá', () => {
    expect([...enFlat.keys()].sort()).toEqual([...viFlat.keys()].sort());
  });

  it('không có chuỗi rỗng và loại giá trị giống nhau', () => {
    for (const [path, value] of enFlat) {
      expect(typeof value, path).toBe(typeof viFlat.get(path));
      if (typeof value === 'string') expect(value.trim(), path).not.toBe('');
      const viValue = viFlat.get(path);
      if (typeof viValue === 'string') {
        expect(String(value).trim(), `vi:${path}`).not.toBe('');
      }
    }
  });

  it('hàm chữ chèn cùng một bộ tham số ở cả hai ngôn ngữ', () => {
    for (const [path, value] of viFlat) {
      if (typeof value !== 'function') continue;
      const enFn = enFlat.get(path) as (...args: never[]) => unknown;
      const viOut = probe(value as (...args: never[]) => unknown).join('\n');
      const enOut = probe(enFn).join('\n');
      expect([...markers(enOut)].sort(), path).toEqual([...markers(viOut)].sort());
    }
  });

  it('bản tiếng Anh không lẫn chữ Việt có dấu (trừ tên ngôn ngữ)', () => {
    const accents = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
    for (const [path, value] of enFlat) {
      if (path === 'languageVi') continue;
      if (typeof value === 'string') expect(accents.test(value), path).toBe(false);
    }
  });
});

describe('chọn ngôn ngữ', () => {
  it('"theo trình duyệt": tiếng Việt thì vi, còn lại en', () => {
    expect(resolveLocale('auto', 'vi')).toBe('vi');
    expect(resolveLocale('auto', 'vi-VN')).toBe('vi');
    expect(resolveLocale('auto', 'en-US')).toBe('en');
    expect(resolveLocale('auto', 'fr')).toBe('en');
  });

  it('lựa chọn cố định thắng ngôn ngữ trình duyệt', () => {
    expect(resolveLocale('vi', 'en-US')).toBe('vi');
    expect(resolveLocale('en', 'vi-VN')).toBe('en');
  });

  it('giá trị lạ trong storage thành "auto"', () => {
    expect(parseLanguagePreference('xx')).toBe('auto');
    expect(parseLanguagePreference(null)).toBe('auto');
    expect(parseLanguagePreference('en')).toBe('en');
  });
});
