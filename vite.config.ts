import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const base = (process.env.BASE_PATH || '/fantrac/').replace(/^\/?/, '/').replace(/\/?$/, '/');
export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'FanTrac — Official Safety Log', short_name: 'FanTrac',
      description: 'Private incident log for officials and school admins.',
      theme_color: '#0f2a4a', background_color: '#f5f7fb', display: 'standalone', start_url: base, scope: base, id: base,
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    },
    scope: base,
    workbox: { navigateFallback: base + 'index.html', globPatterns: ['**/*.{js,css,html,svg,png}'] }
  })]
});
