import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Test files carry the kind in their name: `*.unit.test.*` covers a single
    // module, `*.scenario.test.*` drives a whole flow. Anything else is not
    // picked up, so the convention cannot silently rot.
    //
    // Module tests sit next to the module they cover; `tests/` only holds the
    // ones whose subject is a repository level file (manifest, build config).
    include: ['{src,tests}/**/*.{unit,scenario}.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Type-only module: nothing to execute, so it would only skew the report.
        'src/lib/types.ts',
        // The colocated tests themselves are not part of the measured surface.
        'src/**/*.{unit,scenario}.test.{ts,tsx}',
      ],
      reporter: ['text', 'html'],
    },
  },
});
