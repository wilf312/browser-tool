import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Meet content script.
 *
 * Manifest v3 injects content scripts as classic scripts, so this build emits a
 * single self contained IIFE instead of the ES modules the rest of the
 * extension uses. It writes into the same `dist/` as the main build, hence
 * `emptyOutDir: false` — run it second.
 *
 * Source maps follow the same rule as the main build: everything but
 * `--mode release` keeps them.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: mode !== 'release',
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/content/main.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content/main.js',
      },
    },
  },
}));
