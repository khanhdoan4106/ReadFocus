import { fileURLToPath } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import manifest from './manifest.json' with { type: 'json' };
import { hfAssets, hfTransform } from './vite-plugins/hf-assets.ts';
import { ocrAssets } from './vite-plugins/ocr-assets.ts';

export default defineConfig({
  plugins: [ocrAssets(), hfTransform(), hfAssets(), preact(), crx({ manifest })],
  worker: { format: 'es', plugins: () => [hfTransform()] },
  build: {
    rollupOptions: {
      input: {
        viewer: fileURLToPath(new URL('./viewer.html', import.meta.url)),
      },
    },
  },
});
