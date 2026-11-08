import { describe, expect, it } from 'vitest';
import { bytesToHex, sha256Hex } from '../src/core/hash';

function toArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('sha256Hex', () => {
  it('băm buffer rỗng đúng chuẩn', async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('băm "abc" đúng chuẩn', async () => {
    expect(await sha256Hex(toArrayBuffer('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('nội dung khác thì hash khác và luôn dài 64 ký tự', async () => {
    const first = await sha256Hex(toArrayBuffer('readfocus'));
    const second = await sha256Hex(toArrayBuffer('readfocus '));
    expect(first).not.toBe(second);
    expect(first).toHaveLength(64);
  });
});

describe('bytesToHex', () => {
  it('đệm số 0 ở đầu mỗi byte', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });
});
