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

async function shot(file, { lang, theme, unit, ua, query = '', setup, wait = 600, whatsNew = false, rates, seed }) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    ...(ua ? { userAgent: ua } : {}),
  })
  if (lang) {
    await page.addInitScript(
      ([l, t, u, showWhatsNew]) => {
        localStorage.setItem('sooda:lang', l)
        localStorage.setItem('sooda:theme', t)
        if (u) localStorage.setItem('sooda:unit', u)
        // Pin the inflation rate so the lens and instalment figures are reproducible.
        localStorage.setItem('sooda:inflation', '40')
        // What's New would otherwise cover every other screen on first run.
        if (!showWhatsNew) localStorage.setItem('sooda:last-version', '9.9.9')
      },
      [lang, theme ?? 'light', unit ?? '', whatsNew],
    )
  }
  /* The v1.4 surfaces need national figures the served file does not carry. The app reads its
   * last good value out of localStorage before it fetches, so seeding that (with auto-update off,
   * which makes `refreshRates` return the cached value unchanged) pins the rates without touching
   * a data file. The route is a belt-and-braces second answer for the same request. */
  if (rates) {
    await page.addInitScript((file) => {
      localStorage.setItem('sooda:rates', JSON.stringify(file))
      localStorage.setItem('sooda:rates-auto', 'off')
    }, rates)
    await page.route('**/data/rates.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rates) }),
    )
  }
  const url = `http://localhost:${PORT}${BASE}${query}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  /* Seeding has to wait for the app to have created the database, and Dexie's live queries never
   * see a write made from outside it — so the page is reloaded onto the same URL afterwards. */
  if (seed) {
    await seedDatabase(page, seed)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
  }
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
  // Switching segments runs two shared-layout springs at once (the indicator and the
  // sliding panel) plus the sub-control's height spring; 800ms caught them mid-flight
  // and made the discount shots differ run to run.
  await page.waitForTimeout(1400)
}

/** The v1.3 calculators stack more controls, so the result sits below the fold. */
const scrollToResult = async (page) => {
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
  await page.waitForTimeout(700)
}

/** Fill the lens row: choose how long the money takes to come back. */
const pickMonths = (label) => async (page) => {
  await page.getByRole('radio', { name: label }).click()
  await page.waitForTimeout(700)
}

/** Switch the profit segment to instalment pricing and price a plan. */
const installmentPlan = (cash, term, calcRe, installmentsLabel) => async (page) => {
  await page.getByRole('tab', { name: installmentsLabel }).click()
  await page.waitForTimeout(1200)
  await page.locator('main input[inputmode="decimal"]').nth(0).fill(cash)
  await page.getByRole('radio', { name: term, exact: true }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: calcRe }).first().click()
  await page.waitForTimeout(1800)
}

/** Save the current result as a product, then open the products tab. */
const saveProduct = (name, saveRe, productsRe) => async (page) => {
  await page.getByRole('button', { name: saveRe }).click()
  await page.waitForTimeout(1000)
  await page.locator('[role="dialog"] input[type="text"]').fill(name)
  await page.locator('[role="dialog"]').getByRole('button', { name: saveRe }).last().click()
  await page.waitForTimeout(1400)
  await page.getByRole('tab', { name: productsRe }).click()
  await page.waitForTimeout(1400)
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

/* ---------------- v1.3 surfaces, both directions ---------------- */
const SAVE_EN = /Save to my products/
const SAVE_FA = /ذخیره در کالاهای من/

await shot('en/lens-light', {
  lang: 'en',
  theme: 'light',
  unit: 'toman',
  setup: async (p) => {
    const inputs = p.locator('main input[inputmode="decimal"]')
    await inputs.nth(0).fill('100000')
    await inputs.nth(1).fill('20')
    await pickMonths('3 mo')(p)
    await p.getByRole('button', { name: CALC_EN }).first().click()
    await p.waitForTimeout(1800)
    await scrollToResult(p)
  },
})
await shot('fa/lens-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    const inputs = p.locator('main input[inputmode="decimal"]')
    await inputs.nth(0).fill('۲۵۰۰۰۰')
    await inputs.nth(1).fill('۳۵')
    await pickMonths('۳ ماه')(p)
    await p.getByRole('button', { name: CALC_FA }).first().click()
    await p.waitForTimeout(1800)
    await scrollToResult(p)
  },
})

await shot('en/installment-dark', {
  lang: 'en',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    await installmentPlan('10000000', '6', CALC_EN, /^Installments$/)(p)
    await scrollToResult(p)
  },
})
await shot('fa/installment-light', {
  lang: 'fa',
  theme: 'light',
  unit: 'toman',
  setup: async (p) => {
    await installmentPlan('۱۰۰۰۰۰۰۰', '۶', CALC_FA, /^اقساطی$/)(p)
    await scrollToResult(p)
  },
})

await shot('en/schedule-light', {
  lang: 'en',
  theme: 'light',
  unit: 'toman',
  setup: async (p) => {
    await installmentPlan('10000000', '6', CALC_EN, /^Installments$/)(p)
    await p.getByRole('button', { name: /schedule/i }).first().click()
    await p.waitForTimeout(1200)
  },
})
await shot('fa/schedule-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    await installmentPlan('۱۰۰۰۰۰۰۰', '۶', CALC_FA, /^اقساطی$/)(p)
    await p.getByRole('button', { name: /جدول اقساط/ }).first().click()
    await p.waitForTimeout(1200)
  },
})

await shot('en/products-light', {
  lang: 'en',
  theme: 'light',
  unit: 'toman',
  setup: async (p) => {
    await fill('420000', '25', CALC_EN)(p)
    await saveProduct('Rice, 10 kg', SAVE_EN, /My products/)(p)
  },
})
await shot('fa/products-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  setup: async (p) => {
    await fill('۴۲۰۰۰۰', '۲۵', CALC_FA)(p)
    await saveProduct('برنج هاشمی ۱۰ کیلویی', SAVE_FA, /کالاهای من/)(p)
  },
})

await shot('en/whatsnew-dark', { lang: 'en', theme: 'dark', whatsNew: true, wait: 1400 })
await shot('fa/whatsnew-light', { lang: 'fa', theme: 'light', whatsNew: true, wait: 1400 })

/* ---------------- v1.5 surfaces: the Learning Centre and a lesson in progress ---------------- */
/*
 * `?learn` with no value opens the centre; `?learn=<id>` starts that lesson. Onboarding cannot
 * intercept either, because `shot()` already writes `sooda:last-version`, and a returning user is
 * never offered the first run. A lesson shot is taken in the practice shop, so nothing here
 * depends on the seeded data the v1.4 screens need.
 */

/** Wait for the coach to have measured its first step, so the cutout is not caught mid-flight. */
const coachReady = (waitMs) => async (page) => {
  await page.getByRole('dialog').first().waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(waitMs)
}

await shot('en/learn-center-dark', { lang: 'en', theme: 'dark', query: '?learn', wait: 1200 })
await shot('fa/learn-center-light', { lang: 'fa', theme: 'light', unit: 'toman', query: '?learn', wait: 1200 })

await shot('en/learn-lesson-light', {
  lang: 'en',
  theme: 'light',
  query: '?learn=profit',
  setup: coachReady(1400),
})
await shot('fa/learn-lesson-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  query: '?learn=profit',
  setup: coachReady(1400),
})

/* ---------------- v1.4 surfaces: store setup, the rate card, the check-in ---------------- */
/*
 * These four screens are states of the shopkeeper's own data, not of the calculator, so they
 * cannot be reached by typing into fields: each one is seeded straight into the app's Dexie
 * database ('sooda', v4) and then shot. Nothing here writes to a file the app ships.
 */

const DAY = 86_400_000
/** The estimator's own mean month, so the seeded history means what the card says it means. */
const MONTH = 30.436875 * DAY
const NOW = Date.now()
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)

/**
 * A rates file with figures in it: a monthly CPI per division and ~200 daily dollar closes.
 * Dates are relative to the run, because a fixed `updatedAt` would age past the staleness
 * cut-off and quietly downgrade every confidence badge in the gallery.
 */
function demoRates() {
  const days = 200
  const from = 92_000
  const to = 108_400
  const series = []
  for (let i = days; i >= 0; i -= 1) {
    const progress = (days - i) / days
    // A steady climb with a small deterministic wobble — a straight line looks like a mistake.
    const level = from * Math.pow(to / from, progress) * (1 + 0.004 * Math.sin(i / 7) + 0.002 * Math.cos(i / 3))
    series.push([isoDay(NOW - i * DAY), Math.round(level)])
  }
  return {
    schema: 1,
    updatedAt: isoDay(NOW - 9 * DAY),
    cpi: {
      // Sample figures for the gallery, deliberately attributed to nobody.
      source: { name: 'Sample data', url: '' },
      asOf: isoDay(NOW - 30 * DAY).slice(0, 7),
      overallMonthlyPercent: 2.4,
      categories: { food: 3.1, apparel: 2.2, home: 1.9, digital: 2.8, beauty: 2.1, health: 2.6, auto: 3.4, stationery: 1.6 },
    },
    fx: { source: { name: 'Sample data', url: '' }, pair: 'USD/IRT', series },
  }
}

const RATES = demoRates()

/** The dollar close on the day a cost was recorded, as the app itself would have stored it. */
const fxOn = (at) => {
  let best = null
  for (const [date, rate] of RATES.fx.series) {
    if (Date.parse(`${date}T00:00:00Z`) > at) break
    best = rate
  }
  return best
}

/**
 * One small shop, told twice. `history` is [months ago, purchase price in toman]; the last
 * reading is the product's current cost, which is what makes some of these look stale enough
 * for the check-in to ask about them.
 */
const SHOP = [
  {
    id: 1,
    en: 'Rice, 10 kg',
    fa: 'برنج هاشمی ۱۰ کیلویی',
    category: 'food',
    importDependency: 0,
    targetMarginPercent: 30,
    price: 1_290_000,
    history: [[6.2, 780_000], [4.1, 845_000], [2.4, 910_000], [1.7, 985_000]],
  },
  {
    // Fully dollar-priced, and bought recently enough that the FX line has both ends it needs.
    id: 2,
    en: 'Baby formula, 400 g (imported)',
    fa: 'شیرخشک ۴۰۰ گرمی (وارداتی)',
    category: 'health',
    importDependency: 1,
    targetMarginPercent: 38,
    price: 690_000,
    history: [[5, 385_000], [3, 430_000], [1.55, 498_000]],
  },
  {
    id: 3,
    en: 'Shampoo, 750 ml',
    fa: 'شامپو سر ۷۵۰ میلی‌لیتری',
    category: 'beauty',
    importDependency: 0.5,
    targetMarginPercent: 34,
    price: 245_000,
    history: [[3.5, 168_000], [2.3, 182_000]],
  },
  {
    id: 4,
    en: 'Dish soap, 3.75 L',
    fa: 'مایع ظرف‌شویی ۳٫۷۵ لیتری',
    category: 'home',
    importDependency: 0,
    targetMarginPercent: 35,
    price: 205_000,
    history: [[4, 138_000], [3.1, 152_000]],
  },
  {
    // Checked three weeks ago: still fresh, so the check-in leaves it alone.
    id: 5,
    en: 'Sunflower oil, 1.8 L',
    fa: 'روغن آفتابگردان ۱٫۸ لیتری',
    category: 'food',
    importDependency: 0,
    targetMarginPercent: 33,
    price: 385_000,
    history: [[2, 268_000], [0.82, 289_000]],
  },
]

/** The store setup the shopkeeper would have answered: a grocery that is half dollar-exposed. */
const PROFILE = { id: 'me', categories: ['food', 'beauty', 'home'], importDependency: 0.5 }

/** Dexie rows for one language. `profile` is left out on purpose by the store-setup shots. */
function shopData(lang, { profile = true } = {}) {
  const products = []
  const observations = []
  let observationId = 1
  for (const item of SHOP) {
    const history = item.history.map(([monthsAgo, cost]) => ({ cost, observedAt: Math.round(NOW - monthsAgo * MONTH) }))
    const last = history[history.length - 1]
    products.push({
      id: item.id,
      name: item[lang],
      cost: last.cost,
      targetMarginPercent: item.targetMarginPercent,
      price: item.price,
      unit: 'toman',
      costUpdatedAt: last.observedAt,
      category: item.category,
      importDependency: item.importDependency,
      createdAt: history[0].observedAt,
      updatedAt: last.observedAt,
    })
    history.forEach((point, index) => {
      observations.push({
        id: observationId++,
        productId: item.id,
        cost: point.cost,
        observedAt: point.observedAt,
        // An imported product carries the day's dollar rate, exactly as `recordCost` stores it.
        ...(item.importDependency > 0 ? { fxAtDate: fxOn(point.observedAt) } : {}),
        source: index === 0 ? 'save' : 'checkin',
      })
    })
  }
  return profile ? { products, observations, profile: PROFILE } : { products, observations }
}

/** Writes the shop into the running app's own database with the plain IndexedDB API. */
async function seedDatabase(page, data) {
  await page.waitForFunction(
    async () => (await indexedDB.databases()).some((entry) => entry.name === 'sooda' && (entry.version ?? 0) >= 4),
    null,
    { timeout: 20000 },
  )
  await page.evaluate(async (payload) => {
    const db = await new Promise((resolve, reject) => {
      // No version: the app has already created v4, and asking for one would trigger an upgrade.
      const request = indexedDB.open('sooda')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['products', 'observations', 'storeProfile'], 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
      for (const product of payload.products) tx.objectStore('products').put(product)
      for (const observation of payload.observations) tx.objectStore('observations').put(observation)
      if (payload.profile) tx.objectStore('storeProfile').put(payload.profile)
    })
    db.close()
  }, data)
}

const SHOP_TEXT = {
  en: { why: /Why this number\?/, card: 'Price-rise estimate', checkIn: /Check now/ },
  fa: { why: /چرا این عدد؟/, card: 'تخمین نرخ گرانی', checkIn: /همین حالا/ },
}

/** Setup is never asked at launch: the sheet opens itself on the first products tab with stock in it. */
const storeProfile = () => async (page) => {
  const sheet = page.getByRole('dialog')
  await sheet.waitFor({ state: 'visible', timeout: 20000 })
  /* Chips are rendered in CATEGORY_IDS order — food … beauty — so picking by position says what
   * it means in both languages and survives a re-translation. */
  const chips = sheet.getByRole('checkbox')
  await chips.nth(0).click()
  await page.waitForTimeout(400)
  await chips.nth(4).click()
  await page.waitForTimeout(400)
  /* 'Other' is what an unanswered sheet opens on. Clearing it last leaves food as the primary
   * category, which is the whole point of the dot the first chip carries. */
  await chips.nth(8).click()
  await page.waitForTimeout(1000)
}

/** Open one product and expand the rate card's "why is it this number?" breakdown. */
const rateWhy = (name, text) => async (page) => {
  await page.getByText(name, { exact: true }).first().click()
  await page.waitForTimeout(1500)
  const sheet = page.getByRole('dialog')
  const card = sheet.locator(`section[aria-label="${text.card}"]`)
  await card.waitFor({ state: 'visible', timeout: 20000 })
  await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForTimeout(400)
  await sheet.getByRole('button', { name: text.why }).click()
  // The list springs open under the card; centring again keeps the whole of it in frame.
  await page.waitForTimeout(1000)
  await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForTimeout(600)
}

/** The card at the top of the products tab is the only way into the check-in. */
const checkIn = (text) => async (page) => {
  await page.getByRole('button', { name: text.checkIn }).first().click()
  await page.waitForTimeout(1800)
}

await shot('en/profile-light', {
  lang: 'en',
  theme: 'light',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('en', { profile: false }),
  setup: storeProfile(),
})
await shot('fa/profile-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('fa', { profile: false }),
  setup: storeProfile(),
})

await shot('en/rate-why-dark', {
  lang: 'en',
  theme: 'dark',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('en'),
  setup: rateWhy('Rice, 10 kg', SHOP_TEXT.en),
})
await shot('fa/rate-why-light', {
  lang: 'fa',
  theme: 'light',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('fa'),
  setup: rateWhy('برنج هاشمی ۱۰ کیلویی', SHOP_TEXT.fa),
})

/* The dollar line only appears for an imported product with FX data on both ends of the gap. */
await shot('en/rate-fx-dark', {
  lang: 'en',
  theme: 'dark',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('en'),
  setup: rateWhy('Baby formula, 400 g (imported)', SHOP_TEXT.en),
})
await shot('fa/rate-fx-light', {
  lang: 'fa',
  theme: 'light',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('fa'),
  setup: rateWhy('شیرخشک ۴۰۰ گرمی (وارداتی)', SHOP_TEXT.fa),
})

await shot('en/checkin-light', {
  lang: 'en',
  theme: 'light',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('en'),
  setup: checkIn(SHOP_TEXT.en),
})
await shot('fa/checkin-dark', {
  lang: 'fa',
  theme: 'dark',
  unit: 'toman',
  query: '?tab=products',
  rates: RATES,
  seed: shopData('fa'),
  setup: checkIn(SHOP_TEXT.fa),
})

await browser.close()
server.close()
