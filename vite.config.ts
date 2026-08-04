import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build for everything that Chrome loads as a page or as a module:
 * the settings page (options / popup) and the background service worker.
 *
 * The content script cannot be an ES module, so it is built separately —
 * see `vite.content.config.ts`.
 *
 * `--mode release` builds what gets uploaded to the Chrome Web Store; every
 * other mode builds the copy that is loaded unpacked from disk. The only
 * difference is the source maps — see `build.sourcemap` below.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // While the extension is loaded from disk, readable output is worth more
    // than the last few bytes when something has to be debugged in
    // chrome://extensions. A release ships neither the maps nor the sources
    // they inline, so it drops them.
    sourcemap: mode !== 'release',
    // Vite would emit `<link rel="modulepreload" crossorigin>` for the chunks
    // shared between the settings page and the service worker. Chrome fetches
    // those `chrome-extension://` preloads in a different world than the module
    // graph, so they never match the real request: the page logs "cross-world
    // extension resource mismatch" and downloads the chunk twice. The extension
    // loads from local disk, where the head start buys nothing anyway.
    modulePreload: false,
    rollupOptions: {
      input: {
        options: resolve(import.meta.dirname, 'options.html'),
        background: resolve(import.meta.dirname, 'src/background.ts'),
      },
      output: {
        // `manifest.json` names the service worker, so its path has to be stable.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
}));
