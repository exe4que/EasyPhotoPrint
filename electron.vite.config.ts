import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts'),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@epp/layout-engine': resolve(__dirname, 'packages/layout-engine/src/index.ts'),
        '@epp/migrations': resolve(__dirname, 'packages/migrations/src/index.ts'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html'),
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
  },
});
