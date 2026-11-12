/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Big image folders under public/: cached at runtime (on first view), never precached.
const IMAGE_DIRS = ['escudos', 'competiciones', 'trofeos', 'asociaciones', 'personas']
// Matched against the full URL (a RegExp, since Workbox serialises the pattern into sw.js):
// the path part (before ?/#) must contain /escudos/ etc.
const IMAGE_URL = new RegExp(`^[^?#]*/(${IMAGE_DIRS.join('|')})/`)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the player taps "Actualizar" (see src/pwa/PwaUpdate.tsx),
      // so a reload never interrupts a match.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Manager Web',
        short_name: 'Manager Web',
        description: 'Mánager de fútbol argentino: agarrá un club, armá el plantel y llevalo a lo más alto.',
        lang: 'es-AR',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        id: './',
        theme_color: '#0a1220',
        background_color: '#0a1220',
        categories: ['games', 'sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell: HTML, JS (the JSON data is bundled into it), CSS, icons.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: IMAGE_DIRS.map((d) => `${d}/**`),
        // The main chunk carries the whole world's data; keep it precacheable.
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: IMAGE_DIRS.map((d) => new RegExp(`/${d}/`)),
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: IMAGE_URL,
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagenes',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fuentes-css', expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fuentes',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    // Whole-season simulations of the 20-country world take several seconds on a busy machine.
    testTimeout: 60_000,
  },
})
