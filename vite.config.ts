/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import pkg from './package.json' with { type: 'json' }

// 版本字串：Vercel 會提供 commit SHA；本機則用 dev
const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? 'dev').slice(0, 7)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${sha}`),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // 第三方套件拆成獨立 chunk：App 更新時使用者只需下載變動的程式碼
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            // PDF 相關套件只在下載 PDF 時才載入（不能被下面的 vendor 收進主程式）
            { name: 'vendor-pdf', test: /node_modules[\\/](pdf-lib|@pdf-lib|pako|harfbuzzjs|unicode-properties|unicode-trie|tiny-inflate|dfa|brotli|restructure)[\\/]/, priority: 10 },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // prompt：偵測到新版時不自動更新，交給側邊欄「點此更新」
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: '工作生活規劃',
        short_name: '規劃',
        description: '個人工作＋生活規劃系統',
        lang: 'zh-Hant-TW',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1F2321',
        theme_color: '#303633',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // PDF 套件約 1 MB，不預先快取；第一次下載 PDF 時才抓並放進 pdf-assets 快取
        globIgnores: ['**/vendor-pdf-*.js'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // PDF 用的中文字型（約 7 MB）與字型處理元件：第一次產生 PDF 時下載，之後離線也能用
            urlPattern: ({ url }) => url.pathname.startsWith('/fonts/') || url.pathname.endsWith('.wasm') || /\/vendor-pdf-[^/]+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-assets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 字型檔（含中文分片）首次使用時才快取，避免預快取過大
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
