import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@fitaura/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
