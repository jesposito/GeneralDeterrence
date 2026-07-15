import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 3000,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:3001',
      },
    },
    watch: {
      ignored: ['**/.beads/**', '**/.dolt/**', '**/.gstack/**', '**/.serena/**', '**/.git/**'],
    },
  },
  plugins: [
    react(),
    // gd-0wi.22: service worker precaches the (now fully self-hosted) app shell for offline.
    // The API (/api/*) still needs the network — only the game shell is cached.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // use the existing public/manifest.json (already linked in index.html)
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        globIgnores: ['og-image.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
