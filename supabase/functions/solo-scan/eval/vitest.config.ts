import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^shared\//,
        replacement: fileURLToPath(new URL('../../../../packages/shared/src/', import.meta.url)),
      },
    ],
  },
});
