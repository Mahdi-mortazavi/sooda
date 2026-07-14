// Screenshots the built app at iPhone size for visual review + README shots.
// Usage: node scripts/screenshots.mjs [--out docs/screenshots] [--port 4173]
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'docs/screenshots'
const PORT = 4179
const BASE = '/sooda/'

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
}

// Tiny static server for dist/ under the /sooda/ base path.
const server = createServer(async (req, res) => {
  try {
    let path = (req.url ?? '/').split('?')[0]
    if (!path.startsWith(BASE)) path = BASE
    let rel = path.slice(BASE.length) || 'index.html'
    let file
    try {
      file = await readFile(join('dist', rel))
    } catch {
      file = await readFile(join('dist', 'index.html'))
      rel = 'index.html'
    }
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' })
    res.end(file)
  } catch (e) {
    res.writeHead(500)
    res.end(String(e))
  }
})
await new Promise((r) => server.listen(PORT, r))

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--force-prefers-reduced-motion=no'],
})

async function shot(name, { lang, theme, setup }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await page.addInitScript(
    ([l, t]) => {
      localStorage.setItem('sooda:lang', l)
      localStorage.setItem('sooda:theme', t)
    },
    [lang, theme],
  )
  await page.goto(`http://localhost:${PORT}${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (setup) await setup(page)
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  await page.close()
  console.log(`✓ ${name}`)
}

const fillAndCalc = (a, b) => async (page) => {
  const inputs = page.locator('main input')
  await inputs.nth(0).fill(a)
  await inputs.nth(1).fill(b)
  await page.getByRole('button', { name: /Calculate|محاسبه/ }).click()
  await page.waitForTimeout(1400)
}

const selectMode = (index) => async (page) => {
  await page.locator('[role="tab"]').nth(index).click()
  await page.waitForTimeout(600)
}

await shot('en-light-profit', {
  lang: 'en',
  theme: 'light',
  setup: fillAndCalc('1250', '24'),
})
await shot('en-dark-profit', {
  lang: 'en',
  theme: 'dark',
  setup: fillAndCalc('1250', '24'),
})
await shot('fa-light-profit', {
  lang: 'fa',
  theme: 'light',
  setup: fillAndCalc('۲۵۰۰۰۰', '۳۵'),
})
await shot('fa-dark-profit', {
  lang: 'fa',
  theme: 'dark',
  setup: fillAndCalc('۲۵۰۰۰۰', '۳۵'),
})
await shot('en-light-sell-loss', {
  lang: 'en',
  theme: 'light',
  setup: async (page) => {
    await selectMode(1)(page)
    await fillAndCalc('200', '150')(page)
  },
})
await shot('en-dark-discount', {
  lang: 'en',
  theme: 'dark',
  setup: async (page) => {
    await selectMode(2)(page)
    await fillAndCalc('89.99', '30')(page)
  },
})
await shot('fa-dark-discount', {
  lang: 'fa',
  theme: 'dark',
  setup: async (page) => {
    await selectMode(2)(page)
    await fillAndCalc('۱۹۸۰۰۰', '۱۵')(page)
  },
})
await shot('en-light-history', {
  lang: 'en',
  theme: 'light',
  setup: async (page) => {
    await fillAndCalc('1250', '24')(page)
    await selectMode(1)(page)
    await fillAndCalc('200', '150')(page)
    await selectMode(2)(page)
    await fillAndCalc('89.99', '30')(page)
    await page.getByRole('button', { name: /Open history/ }).click()
    await page.waitForTimeout(900)
  },
})
await shot('fa-dark-history', {
  lang: 'fa',
  theme: 'dark',
  setup: async (page) => {
    await fillAndCalc('۲۵۰۰۰۰', '۳۵')(page)
    await page.getByRole('button', { name: /تاریخچه/ }).click()
    await page.waitForTimeout(900)
  },
})
await shot('en-light-settings', {
  lang: 'en',
  theme: 'light',
  setup: async (page) => {
    await page.getByRole('button', { name: /Open settings/ }).click()
    await page.waitForTimeout(900)
  },
})
await shot('en-light-empty-history', {
  lang: 'en',
  theme: 'light',
  setup: async (page) => {
    await page.getByRole('button', { name: /Open history/ }).click()
    await page.waitForTimeout(900)
  },
})

await browser.close()
server.close()
console.log('done')
