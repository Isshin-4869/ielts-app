/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のパス（https://<user>.github.io/ielts-app/）
const BASE = '/ielts-app/';

// 開発時だけ、手元の data/out/items.json をボタン1つで取り込めるようにする（本番ビルドには入らない）
const devItemsPath = fileURLToPath(new URL('../data/out/items.json', import.meta.url));

export default defineConfig(({ command }) => ({
  base: BASE,
  define: {
    __DEV_ITEMS_URL__: JSON.stringify(command === 'serve' ? `${BASE}@fs${devItemsPath}` : ''),
  },
  server: {
    fs: { allow: ['.', fileURLToPath(new URL('../data/out', import.meta.url))] },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'IELTS 単語',
        short_name: 'IELTS単語',
        description: '手持ちの単語帳だけを覚えるための英単語アプリ',
        lang: 'ja',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
