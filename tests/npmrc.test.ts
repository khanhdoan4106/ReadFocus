import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const path = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

describe('.npmrc', () => {
  it('bỏ qua bước tải CUDA từ nuget của onnxruntime-node (extension không dùng bản Node)', () => {
    const lines = readFileSync(path('.npmrc'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim());
    expect(lines).toContain('onnxruntime-node-install=skip');
  });

  // Nếu nâng onnxruntime-node mà script ngừng đọc cờ này qua npm_config_*, .npmrc sẽ vô tác dụng
  // và `npm ci` trên CI Linux lại tải từ api.nuget.org: test này báo ngay.
  it.skipIf(!existsSync(path('node_modules/onnxruntime-node/script/install-utils.js')))(
    'script cài của onnxruntime-node đọc cờ qua npm_config_onnxruntime_node_install và hiểu "skip"',
    () => {
      const source = readFileSync(
        path('node_modules/onnxruntime-node/script/install-utils.js'),
        'utf8',
      );
      expect(source).toContain('process.env.npm_config_onnxruntime_node_install');
      expect(source).toMatch(/case 'skip':\s*return false;/);
    },
  );
});
