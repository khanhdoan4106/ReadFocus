import { fileURLToPath } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import manifest from './manifest.json' with { type: 'json' };
import { ocrAssets } from './vite-plugins/ocr-assets.ts';

export default defineConfig({
  plugins: [ocrAssets(), preact(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        viewer: fileURLToPath(new URL('./viewer.html', import.meta.url)),
      },
    },
  },
});
