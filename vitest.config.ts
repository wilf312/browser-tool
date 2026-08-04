import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Test files carry the kind in their name: `*.unit.test.*` covers a single
    // module, `*.scenario.test.*` drives a whole flow. Anything else is not
    // picked up, so the convention cannot silently rot.
    include: ['tests/**/*.{unit,scenario}.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Type-only module: nothing to execute, so it would only skew the report.
      exclude: ['src/lib/types.ts'],
      reporter: ['text', 'html'],
    },
  },
});
