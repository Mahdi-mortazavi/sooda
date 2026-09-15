/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

const BASE = '/sooda/'

// @types/node is intentionally not a dependency (tsconfig limits `types` to the
// vite clients), so declare the sliver of process the commit stamp needs.
declare const process: { env: Record<string, string | undefined> }

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

/**
 * Emits dist/version.json so a deployed build can be identified over the network
 * without unpacking the bundle — the post-deploy check reads it to confirm the
 * new release is actually live.
 */
function versionManifest(): Plugin {
  return {
    name: 'sooda:version-manifest',
    apply: 'build',
    generateBundle() {
      const source = `${JSON.stringify(
        {
          version: pkg.version,
          commit: process.env.GITHUB_SHA ?? process.env.SOODA_COMMIT ?? 'local',
          builtAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`
      this.emitFile({ type: 'asset', fileName: 'version.json', source })
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
    versionManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og.png'],
      manifest: {
        id: BASE,
        name: 'Sooda',
        short_name: 'Sooda',
        description:
          'Know whether your profit survives restocking. Sooda is a profit, price and discount calculator for sellers: real profit after inflation, instalment pricing, your own product list, and a smart per-product price-growth estimate. Works offline, private, bilingual English/Persian.',
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
          {
            name: 'My products · کالاهای من',
            short_name: 'Products',
            url: `${BASE}?tab=products`,
            icons: [{ src: 'shortcut-products.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // version.json must always come from the network, otherwise a post-deploy
        // check would read the precached copy and never see the new release.
        // data/*.json is the public rates feed. json is already outside globPatterns,
        // but say it out loud: anything precached lands in the manifest with a content
        // hash, so a rates refresh would rewrite sw.js and ship an app update to every
        // installed device just to change a number. It is runtime-cached below instead.
        globIgnores: ['**/version.json', '**/data/*.json'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // A route matcher is serialized into sw.js by its source text alone, with no
            // closure, so BASE cannot be interpolated here — the pathname is spelled out.
            // sameOrigin plus an exact pathname match: no other request on the origin,
            // and nothing off it, can reach this route.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/sooda/data/rates.json',
            // Stale-while-revalidate keeps the app instant and usable offline after one
            // successful fetch, while still picking up a fresh file in the background.
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'sooda-data',
              // One live entry; the spare headroom just absorbs an in-flight rename.
              expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 },
              // Never cache a 404 or an opaque redirect as if it were rates data.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
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
