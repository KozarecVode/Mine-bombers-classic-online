import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    // Allow importing shared package source directly in dev
    alias: {
      '@minebombers/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
