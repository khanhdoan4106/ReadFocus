import { badResponse } from './errors';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** JSON hỏng trong response 2xx là `bad-response`, không phải lỗi mạng. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw badResponse('Response is not valid JSON', error);
  }
}

/** Ghép các đoạn text không rỗng; giữ nguyên thứ tự model trả về. */
export function joinText(pieces: readonly string[]): string {
  return pieces.filter((piece) => piece !== '').join('');
}
