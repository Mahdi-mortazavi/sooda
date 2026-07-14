// Screenshots the built app at iPhone size for visual review + README galleries.
// Produces docs/screenshots/{en,fa}/*.png plus hero.png / hero-fa.png composites.
// Usage: node scripts/screenshots.mjs [--out docs/screenshots]
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

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
}

const server = createServer(async (req, res) => {
  let path = (req.url ?? '/').split('?')[0]
  let rel = path.startsWith(BASE) ? decodeURIComponent(path.slice(BASE.length)) || 'index.html' : ''
  let file
  try {
    file = await readFile(join('dist', rel))
  } catch {
    file = await readFile(join('dist', 'index.html'))
    rel = 'index.html'
  }
  res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' })
  res.end(file)
})
await new Promise((r) => server.listen(PORT, r))

await mkdir(join(OUT, 'en'), { recursive: true })
await mkdir(join(OUT, 'fa'), { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'

async function shot(file, { lang, theme, unit, ua, query = '', setup, wait = 600 }) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    ...(ua ? { userAgent: ua } : {}),
  })
  if (lang) {
    await page.addInitScript(
      ([l, t, u]) => {
        localStorage.setItem('sooda:lang', l)
        localStorage.setItem('sooda:theme', t)
        if (u) localStorage.setItem('sooda:unit', u)
      },
      [lang, theme ?? 'light', unit ?? ''],
    )
  }
  await page.goto(`http://localhost:${PORT}${BASE}${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  if (setup) await setup(page)
  await page.waitForTimeout(wait)
  await page.screenshot({ path: join(OUT, `${file}.png`) })
  await page.close()
  console.log(`✓ ${file}`)
}

const fill = (a, b, calcRe) => async (page) => {
  const inputs = page.locator('main input')
  await inputs.nth(0).fill(a)
  await inputs.nth(1).fill(b)
  await page.getByRole('button', { name: calcRe }).first().click()
  await page.waitForTimeout(1500)
}

const pickSegment = (index) => async (page) => {
  await page.locator('[role="tablist"]').first().locator('[role="tab"]').nth(index).click()
  await page.waitForTimeout(800)
}

const addToBasket = (re) => async (page) => {
  await page.getByRole('button', { name: re }).click()
  await page.waitForTimeout(500)
}

/* ---------------- shared ---------------- */
await shot('welcome', {})

/* ---------------- English set ---------------- */
const CALC_EN = /Calculate/
await shot('en/profit-light', { lang: 'en', theme: 'light', setup: fill('1250', '24', CALC_EN) })
await shot('en/profit-dark', { lang: 'en', theme: 'dark', setup: fill('1250', '24', CALC_EN) })
await shot('en/sell-loss-light', {
  lang: 'en',
  theme: 'light',
  setup: async (p) => {
    await pickSegment(1)(p)
    await fill('200', '150', CALC_EN)(p)
  },
})
await shot('en/discount-dark', {
  lang: 'en',
  theme: 'dark',
  unit: 'usd',
  setup: async (p) => {
    await pickSegment(2)(p)
    await fill('89.99', '30', CALC_EN)(p)
  },
})
await shot('en/rdiscount-light', {
  lang: 'en',
  theme: 'light',
  unit: 'eur',
  setup: async (p) => {
    await pickSegment(2)(p)
    await p.getByRole('tab', { name: /Find original price/ }).click()
    await p.waitForTimeout(1000)
    await fill('62.99', '30', CALC_EN)(p)
  },
})
await shot('en/basket-dark', {
  lang: 'en',
  theme: 'dark',
  unit: 'usd',
  setup: async (p) => {
    await fill('1250', '24', CALC_EN)(p)
    await addToBasket(/Add to basket/)(p)
    await pickSegment(1)(p)
    await fill('300', '390', CALC_EN)(p)
    await addToBasket(/Add to basket/)(p)
    await p.getByRole('button', { name: /Open basket/ }).click()
    await p.waitForTimeout(1000)
  },
})
await shot('en/history-light', {
  lang: 'en',
  theme: 'light',
  setup: async (p) => {
    await fill('1250', '24', CALC_EN)(p)
    await pickSegment(1)(p)
    await fill('200', '150', CALC_EN)(p)
    await pickSegment(2)(p)
    await fill('89.99', '30', CALC_EN)(p)
    await p.getByRole('button', { name: /Open history/ }).click()
    await p.waitForTimeout(1000)
  },
})
await shot('en/settings-dark', {
  lang: 'en',
  theme: 'dark',
  setup: async (p) => {
    await p.getByRole('button', { name: /Open settings/ }).click()
    await p.waitForTimeout(1000)
  },
})
await shot('en/install-ios', {
  lang: 'en',
  theme: 'light',
  ua: IOS_UA,
  setup: async (p) => {
    await p.waitForTimeout(2600)
    await p.getByRole('button', { name: /How to install/ }).click()
    await p.waitForTimeout(1000)
  },
})

/* ---------------- Persian set ---------------- */
const CALC_FA = /محاسبه/
await shot('fa/profit-light', { lang: 'fa', theme: 'light', unit: 'toman', setup: fill('۲۵۰۰۰۰', '۳۵', CALC_FA) })
await shot('fa/profit-dark', { lang: 'fa', theme: 'dark', unit: 'toman', setup: fill('۲۵۰۰۰۰', '۳۵', CALC_FA) })
await shot('fa/sell-loss-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    await pickSegment(1)(p)
    await fill('۲۰۰۰۰۰', '۱۵۰۰۰۰', CALC_FA)(p)
  },
})
await shot('fa/discount-light', {
  lang: 'fa',
  theme: 'light',
  unit: 'toman',
  setup: async (p) => {
    await pickSegment(2)(p)
    await fill('۱۹۸۰۰۰', '۱۵', CALC_FA)(p)
  },
})
await shot('fa/rdiscount-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    await pickSegment(2)(p)
    await p.getByRole('tab', { name: /قیمت اصلی/ }).click()
    await p.waitForTimeout(1000)
    await fill('۸۵۰۰۰', '۱۵', CALC_FA)(p)
  },
})
await shot('fa/basket-light', {
  lang: 'fa',
  theme: 'light',
  unit: 'toman',
  setup: async (p) => {
    await fill('۲۵۰۰۰۰', '۳۵', CALC_FA)(p)
    await addToBasket(/افزودن به سبد/)(p)
    await pickSegment(1)(p)
    await fill('۱۲۰۰۰۰', '۱۸۰۰۰۰', CALC_FA)(p)
    await addToBasket(/افزودن به سبد/)(p)
    await p.getByRole('button', { name: /بازکردن سبد/ }).click()
    await p.waitForTimeout(1000)
  },
})
await shot('fa/history-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    await fill('۲۵۰۰۰۰', '۳۵', CALC_FA)(p)
    await pickSegment(2)(p)
    await fill('۱۹۸۰۰۰', '۱۵', CALC_FA)(p)
    await p.getByRole('button', { name: /بازکردن تاریخچه/ }).click()
    await p.waitForTimeout(1000)
  },
})
await shot('fa/settings-light', {
  lang: 'fa',
  theme: 'light',
  setup: async (p) => {
    await p.getByRole('button', { name: /بازکردن تنظیمات/ }).click()
    await p.waitForTimeout(1000)
  },
})
await shot('fa/install-ios', {
  lang: 'fa',
  theme: 'dark',
  ua: IOS_UA,
  setup: async (p) => {
    await p.waitForTimeout(2600)
    await p.getByRole('button', { name: /راهنمای نصب/ }).click()
    await p.waitForTimeout(1000)
  },
})

await browser.close()
server.close()

/* ---------------- hero composites ---------------- */
async function hero(outName, leftPath, rightPath) {
  const left = await sharp(join(OUT, leftPath)).resize(500).toBuffer()
  const right = await sharp(join(OUT, rightPath)).resize(500).toBuffer()
  const h = Math.round((500 * 1688) / 780) + 60
  await sharp({ create: { width: 1060, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: left, left: 20, top: 30 },
      { input: right, left: 540, top: 30 },
    ])
    .png()
    .toFile(join(OUT, outName))
  console.log(`✓ ${outName}`)
}
await hero('hero.png', 'en/profit-light.png', 'en/profit-dark.png')
await hero('hero-fa.png', 'fa/profit-light.png', 'fa/profit-dark.png')

console.log('done')
