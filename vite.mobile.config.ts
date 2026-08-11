import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'src/mobile'),
  build: {
    outDir: resolve(__dirname, 'out/mobile'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/mobile/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@epp/layout-engine': resolve(__dirname, 'packages/layout-engine/src/index.ts'),
      '@epp/migrations': resolve(__dirname, 'packages/migrations/src/index.ts'),
    },
  },
  plugins: [react()],
});
