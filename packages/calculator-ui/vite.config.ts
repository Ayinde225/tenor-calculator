import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The engine is consumed from source so the UI and engine typecheck as one unit
// and hot-reload together during development. fileURLToPath (not URL.pathname)
// is required for a correct Windows path — pathname keeps the URL encoding and a
// leading slash that mangle drive letters.
const enginePath = fileURLToPath(new URL('../calculator-core/src/index.ts', import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@tenor/calculator-core': enginePath,
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
