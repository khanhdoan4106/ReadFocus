import { describe, expect, it } from 'vitest';
import {
  CLOCK_SKEW_MS,
  chooseWinner,
  isSyncKey,
  remoteReadingAhead,
  sanitizeSyncRecord,
  SYNC_VALUE_FIELDS,
  syncKey,
  toSyncValue,
} from '../src/core/sync/record';

const HASH = 'a'.repeat(32) + 'b'.repeat(32);
const NOW = 1_800_000_000_000;
const rec = (page: number, updatedAt: number, pageCount = 100) => ({ page, pageCount, updatedAt });

describe('khóa đồng bộ', () => {
  it('p:<32 ký tự đầu của SHA-256>', () => {
    expect(syncKey(HASH)).toBe(`p:${'a'.repeat(32)}`);
    expect(isSyncKey(syncKey(HASH) as string)).toBe(true);
  });

  it.each(['', 'khong-phai-hex', 'abc', 'g'.repeat(64)])(
    'docId không hợp lệ (%s) thì null',
    (id) => {
      expect(syncKey(id)).toBeNull();
    },
  );

  it('isSyncKey từ chối khóa khác (autoOpenPdf, độ dài sai, hoa thường sai)', () => {
    for (const key of [
      'autoOpenPdf',
      'p:abc',
      `p:${'A'.repeat(32)}`,
      `q:${'a'.repeat(32)}`,
      `p:${'a'.repeat(33)}`,
    ]) {
      expect(isSyncKey(key)).toBe(false);
    }
  });
});

describe('giá trị đồng bộ chỉ có đúng ba trường', () => {
  it('toSyncValue bỏ mọi trường thừa (tên file, ghi chú, key...)', () => {
    const dirty = {
      ...rec(5, 10),
      name: 'sach-bi-mat.pdf',
      note: 'ghi chú',
      text: 'văn bản trang',
      apiKey: 'sk-test',
    };
    const value = toSyncValue(dirty);
    expect(Object.keys(value).sort()).toEqual([...SYNC_VALUE_FIELDS].sort());
    expect(JSON.stringify(value)).not.toMatch(/sach-bi-mat|ghi chú|văn bản|sk-test/);
  });

  it('sanitize đọc dữ liệu từ máy khác: bỏ trường lạ, từ chối sai kiểu', () => {
    expect(sanitizeSyncRecord({ ...rec(3, 1), thua: 'x' })).toEqual(rec(3, 1));
    for (const bad of [
      null,
      'x',
      {},
      { ...rec(0, 1) },
      { ...rec(3, 1), pageCount: 0 },
      rec(9, 1, 5),
      { ...rec(1, 1), updatedAt: 'x' },
      { ...rec(1.5, 1) },
      { ...rec(1, -1) },
    ]) {
      expect(sanitizeSyncRecord(bad)).toBeNull();
    }
  });
});

describe('chooseWinner (last-writer-wins)', () => {
  it('bản mới hơn thắng', () => {
    expect(chooseWinner(rec(1, 100), rec(2, 200), NOW)).toBe('remote');
    expect(chooseWinner(rec(1, 300), rec(2, 200), NOW)).toBe('local');
  });

  it('trùng thời điểm: giữ bản trên máy này', () => {
    expect(chooseWinner(rec(1, 100), rec(2, 100), NOW)).toBe('same');
  });

  it('dữ liệu hỏng: bản hỏng không thắng', () => {
    expect(chooseWinner(rec(1, 100), { page: 'x' }, NOW)).toBe('local');
    expect(chooseWinner(null, rec(2, 100), NOW)).toBe('remote');
    expect(chooseWinner(null, null, NOW)).toBe('local');
  });

  it('đồng hồ lệch: mốc quá xa trong tương lai bị kẹp, không thắng mãi', () => {
    const farFuture = NOW + 10 * CLOCK_SKEW_MS;
    // Máy kia chạy nhanh 10 ngày: mốc bị kẹp về now + 1 ngày; bản thật sự mới hơn trong dung sai vẫn thắng.
    expect(chooseWinner(rec(1, NOW + CLOCK_SKEW_MS + 5), rec(2, farFuture), NOW)).toBe('same');
    expect(chooseWinner(rec(1, NOW), rec(2, farFuture), NOW)).toBe('remote');
  });

  it('chênh lệch nhỏ do đồng hồ lệch vẫn so sánh bình thường', () => {
    expect(chooseWinner(rec(1, NOW), rec(2, NOW + 5_000), NOW)).toBe('remote');
    expect(chooseWinner(rec(1, NOW), rec(2, NOW - 5_000), NOW)).toBe('local');
  });
});

describe('remoteReadingAhead (có báo "Trên máy khác bạn đã đọc tới trang X" không)', () => {
  it('bản đồng bộ mới hơn và khác trang thì báo', () => {
    expect(remoteReadingAhead({ page: 3, updatedAt: 100 }, rec(9, 200), NOW)).toEqual(rec(9, 200));
  });

  it('cùng trang, cũ hơn hoặc bằng, hỏng: không báo', () => {
    expect(remoteReadingAhead({ page: 9, updatedAt: 100 }, rec(9, 200), NOW)).toBeNull();
    expect(remoteReadingAhead({ page: 3, updatedAt: 300 }, rec(9, 200), NOW)).toBeNull();
    expect(remoteReadingAhead({ page: 3, updatedAt: 200 }, rec(9, 200), NOW)).toBeNull();
    expect(remoteReadingAhead({ page: 3, updatedAt: 100 }, { page: 'x' }, NOW)).toBeNull();
  });

  it('máy này chưa có tiến độ thì bản đồng bộ được báo', () => {
    expect(remoteReadingAhead(null, rec(4, 50), NOW)).toEqual(rec(4, 50));
  });
});
