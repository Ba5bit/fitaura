import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve the workspace package to its TS source so Vite transpiles it.
      '@fitaura/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the heaviest third-party deps out of the single app chunk so the
         * public Landing no longer ships one ~500 KB monolith. React + Router and
         * the Supabase client become their own long-lived chunks: they change far
         * less often than app code, so repeat visits serve them from cache, and the
         * browser parses several smaller files instead of one giant blocking one.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
