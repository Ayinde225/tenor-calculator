import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.ts'],
    // Playwright owns the e2e specs; vitest must not try to collect them.
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/calculator-core/src/**'],
    },
  },
});
