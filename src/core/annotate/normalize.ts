/**
 * Chuẩn hóa văn bản để so khớp: NFC và gộp mọi khoảng trắng thành một dấu cách. Giữ bảng
 * ánh xạ về offset trong văn bản gốc để đổi kết quả tìm được về lại vị trí thật.
 */
export type NormalizedText = {
  text: string;
  /** `starts[i]`: offset đầu (trong văn bản gốc) của cụm ký tự sinh ra đơn vị `i`. */
  starts: number[];
  /** `ends[i]`: offset cuối (không gồm) của cụm đó. */
  ends: number[];
};

const WHITESPACE = /\s/u;
const COMBINING = /\p{M}/u;

export function normalizeWithMap(source: string): NormalizedText {
  let text = '';
  const starts: number[] = [];
  const ends: number[] = [];

  const push = (piece: string, from: number, to: number): void => {
    for (let i = 0; i < piece.length; i += 1) {
      starts.push(from);
      ends.push(to);
    }
    text += piece;
  };

  const chars = Array.from(source);
  let offset = 0;
  let index = 0;
  while (index < chars.length) {
    const char = chars[index] as string;
    if (WHITESPACE.test(char)) {
      const from = offset;
      while (index < chars.length && WHITESPACE.test(chars[index] as string)) {
        offset += (chars[index] as string).length;
        index += 1;
      }
      push(' ', from, offset);
      continue;
    }
    // Một ký tự gốc cùng các dấu kết hợp theo sau (tiếng Việt dạng NFD) là một cụm.
    const from = offset;
    let cluster = char;
    offset += char.length;
    index += 1;
    while (index < chars.length && COMBINING.test(chars[index] as string)) {
      cluster += chars[index] as string;
      offset += (chars[index] as string).length;
      index += 1;
    }
    push(cluster.normalize('NFC'), from, offset);
  }
  return { text, starts, ends };
}

export function normalizeForMatch(source: string): string {
  return normalizeWithMap(source).text;
}
