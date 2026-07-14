/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

const BASE = '/sooda/'

/**
 * Inlines the built stylesheet into index.html, removing a render-blocking
 * request on first load. Font URLs in the CSS are absolute, so relocation is safe.
 */
function inlineCss(): Plugin {
  return {
    name: 'sooda:inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        for (const [fileName, output] of Object.entries(bundle)) {
          if (output.type !== 'asset' || !fileName.endsWith('.css')) continue
          const href = `${BASE}${fileName}`
          const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const linkRe = new RegExp(`<link[^>]*rel="stylesheet"[^>]*href="${escaped}"[^>]*>`)
          if (linkRe.test(html)) {
            html = html.replace(linkRe, `<style>${output.source}</style>`)
            delete bundle[fileName]
          }
        }
        // Move the entry module script from <head> to the end of <body> so the
        // static boot shell paints before script fetching even starts.
        const scriptRe = /<script type="module" crossorigin src="[^"]+"><\/script>/
        const scriptTag = html.match(scriptRe)?.[0]
        if (scriptTag) {
          html = html.replace(scriptRe, '')
          html = html.replace('</body>', `  ${scriptTag}\n  </body>`)
        }
        return html
      },
    },
  }
}

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    inlineCss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og.png'],
      manifest: {
        id: BASE,
        name: 'Sooda',
        short_name: 'Sooda',
        description:
          'Profit math, crystal clear. Offline-first, bilingual (English/Persian) profit, price & discount calculator.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        lang: 'en',
        dir: 'ltr',
        categories: ['finance', 'productivity', 'utilities'],
        launch_handler: { client_mode: 'navigate-existing' },
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Profit % · درصد سود',
            short_name: 'Profit %',
            url: `${BASE}?m=profit`,
            icons: [{ src: 'shortcut-profit.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Sell price · قیمت فروش',
            short_name: 'Sell price',
            url: `${BASE}?m=sell`,
            icons: [{ src: 'shortcut-sell.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Discount · تخفیف',
            short_name: 'Discount',
            url: `${BASE}?m=discount`,
            icons: [{ src: 'shortcut-discount.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
