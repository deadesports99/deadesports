import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Admin console — runs on 5174 because the backend CSRF origin gate expects
 * `ADMIN_WEB_ORIGIN=http://localhost:5174` in development.
 *
 * `/api` and `/ws` are proxied to the Express server so the browser only ever
 * talks to one origin: the httpOnly `admin_session` cookie stays host-only and
 * no CORS (or token in JS) is needed.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: false },
      '/ws': { target: 'ws://localhost:5000', ws: true, changeOrigin: false },
    },
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
  build: {
    // Admin console should not ship readable source maps to production.
    sourcemap: false,
  },
});
