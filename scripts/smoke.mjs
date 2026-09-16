// Drives the built app in a real browser through the flows that matter, so a release
// is never signed off on unit tests alone.
// Usage: node scripts/smoke.mjs        (run after `npm run build`)
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { chromium } from 'playwright-core'
import { printDurations, runLearnFlows } from './smoke-learn.mjs'

const BASE = '/sooda/'

/* The app's own version, not a literal. Seeding a hard-coded "already seen" version means
 * that the next release makes What's New open over every flow and every click times out —
 * which is exactly what the v1.4.0 bump did. */
const APP_VERSION = JSON.parse(await readFile('package.json', 'utf8')).version
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]
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
/* Port 0, not a fixed one: the tutorial flows below open a page per lesson, the run is long,
 * and a second checkout of this repo smoke-testing at the same time must not fail on a port
 * clash rather than on the app. */
await new Promise((r) => server.listen(0, r))
const PORT = server.address().port

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/* Development only, and never set in CI: `SMOKE_ONLY=lesson npm run smoke` runs the flows whose
 * name contains that text. A whole run is several minutes once the eight lessons are in it, and
 * iterating on one of them should not mean sitting through the other seven. */
const ONLY = process.env.SMOKE_ONLY ?? ''

/** One flow failing should not hide the rest. */
async function flow(name, run) {
  if (ONLY !== '' && !name.includes(ONLY)) {
    console.log(`· skipped "${name}" (SMOKE_ONLY=${ONLY})`)
    return
  }
  try {
    await run()
  } catch (err) {
    check(`${name} completed`, false, String(err.message).split('\n')[0])
    /* `SMOKE_STACK=1` adds Playwright's own call log, which names the locator that gave up —
     * the difference between "a click timed out" and "it was clicking a lesson card in the
     * Learning Centre". Off by default: it is six lines per failure. */
    if (process.env.SMOKE_STACK) console.log(String(err.stack).split('\n').slice(0, 6).join('\n'))
  }
}

/** A page with a known language, theme and inflation rate, so results are deterministic. */
async function open({ lang = 'en', query = '', storage = {}, fresh = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  if (!fresh) {
    // Mark What's New as already seen so its modal does not block the other flows;
    // the flow that tests it clears this deliberately.
    const seed = {
      'sooda:lang': lang,
      'sooda:theme': 'light',
      /* Deliberately the v1.4 key, holding an ANNUAL 40%. Every inflation-dependent expectation
       * below was briefed at 40%/yr, so they only still hold if the v1.5 migration converts it
       * to the equivalent monthly rate — which makes this suite integration coverage for that
       * migration as well as for the flows themselves. */
      'sooda:inflation': '40',
      'sooda:last-version': APP_VERSION,
      ...storage,
    }
    await page.addInitScript((entries) => {
      for (const [k, v] of Object.entries(entries)) {
        if (v === undefined) localStorage.removeItem(k)
        else localStorage.setItem(k, v)
      }
    }, seed)
  }
  page.on('pageerror', (err) => check(`no page error (${query || 'root'})`, false, err.message))
  await page.goto(`http://localhost:${PORT}${BASE}${query}`, { waitUntil: 'networkidle' })
  /* An earlier attempt at this harness measured a directory listing for a whole run, because a
   * mis-built `--base` leaves `/sooda/` serving the folder rather than the app and every
   * "element not found" then reads as a broken flow. One assertion makes that impossible. */
  const title = await page.title()
  if (!/Sooda/i.test(title)) throw new Error(`the served page is not the app — <title> was "${title}"`)
  await page.waitForTimeout(700)
  return page
}

const digits = (text) => text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d.]/g, '')
const fields = (page) => page.locator('main input[inputmode="decimal"]')
const calc = (page) => page.getByRole('button', { name: /^Calculate$/ }).first().click()

/* Splitting the translations into a core bundle and a sheets bundle makes it possible to
 * render a string whose bundle has not loaded — i18next then prints the raw key path.
 * Every screen the smoke test visits is scanned for that. */
const KEY_LIKE =
  /\b(?:app|modes|fields|actions|results|errors|history|settings|discountDirection|install|basket|dev|lens|installment|tabs|products|whatsNew)\.[a-zA-Z][a-zA-Z.]*/g

async function assertNoRawKeys(page, where) {
  const text = await page.locator('body').innerText()
  const found = [...new Set(text.match(KEY_LIKE) ?? [])]
  check(`no untranslated keys on ${where}`, found.length === 0, found.join(', '))
}

/** The card is a lazy chunk, so wait for it rather than guessing a delay. */
async function resultText(page) {
  const card = page.locator('section[aria-label="Result"]')
  await card.waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1500) // let the count-up springs settle on their final values
  return card.innerText()
}

await flow('profit lens', async () => {
  const page = await open()
  await fields(page).nth(0).fill('100000')
  await fields(page).nth(1).fill('20')
  await page.getByRole('radio', { name: '3 mo' }).click()
  await page.waitForTimeout(400)
  await calc(page)
  const body = await resultText(page)
  check('lens: suggested price is 130,530.88', digits(body).includes('130530.88'))
  check('lens: shows nominal 20% and real 10.32%', /10\.32/.test(body) && /\b20/.test(body))
  check('lens: status chip reads Thin', /Thin/.test(body))
  check('lens: explainer names the restock cost', /108,775\.73/.test(body))
  await assertNoRawKeys(page, 'the profit lens')
  await page.close()
})

await flow('sell lens losing', async () => {
  const page = await open()
  await page.getByRole('tab', { name: /Sell price/ }).click()
  await page.waitForTimeout(700)
  await fields(page).nth(0).fill('100000')
  await fields(page).nth(1).fill('105000')
  await page.getByRole('radio', { name: '6 mo' }).click()
  await page.waitForTimeout(400)
  await calc(page)
  const body = await resultText(page)
  check('sell lens: status is Losing', /Losing/.test(body))
  check('sell lens: shows the cannot-rebuy sentence', /can’t buy the same goods again/.test(body))
  await assertNoRawKeys(page, 'the sell lens')
  await page.close()
})

await flow('instalments', async () => {
  const page = await open()
  await page.getByRole('tab', { name: /^Installments$/ }).click()
  await page.waitForTimeout(800)
  await fields(page).nth(0).fill('10000000')
  await page.getByRole('radio', { name: '6', exact: true }).click()
  await page.waitForTimeout(400)
  await calc(page)
  const body = await resultText(page)
  check('instalment forward: monthly 1,836,418.28', digits(body).includes('1836418.28'))
  check('instalment forward: total 11,018,509.68', digits(body).includes('11018509.68'))
  check('instalment forward: markup 10.19%', /10\.19/.test(body))
  check('instalment forward: flat monthly 1.7%', /1\.7/.test(body))
  check('instalment forward: carries the no-loss explainer', /your profit is in the cash price/.test(body))

  await page.getByRole('button', { name: /schedule/i }).first().click()
  await page.waitForTimeout(1200)
  const sheet = await page.locator('[role="dialog"]').innerText()
  const rows = (sheet.match(/1,836,418\.28/g) ?? []).length
  check('schedule: lists six instalments', rows >= 6, `${rows} rows`)
  check('schedule: keeps margin and markup away from the customer', !/markup|profit|10\.19/i.test(sheet))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  await page.getByRole('tab', { name: /Is my deal profitable/ }).click()
  await page.waitForTimeout(800)
  await fields(page).nth(0).fill('10000000')
  await page.getByRole('radio', { name: '6', exact: true }).click()
  await fields(page).last().fill('3')
  await page.waitForTimeout(400)
  await calc(page)
  const rev = await resultText(page)
  check('instalment reverse: real gain 7.09%', /7\.09/.test(rev))
  check('instalment reverse: value today 10,709,252.29', digits(rev).includes('10709252.29'))
  await assertNoRawKeys(page, 'the instalment check')
  await page.close()
})

await flow('legacy and v2 links', async () => {
  const legacy = await open({ query: '?m=profit&a=1250&b=24&u=toman' })
  const body = await resultText(legacy)
  check('v1.2.0 share link still computes', digits(body).includes('1550'))
  await legacy.close()

  // A Toman figure read as Rial is a tenfold error, so the link's unit must win.
  const foreign = await open({ query: '?m=discount&a=250000&b=30&u=toman', storage: { 'sooda:unit': 'rial' } })
  const foreignBody = await resultText(foreign)
  check("a shared link's currency beats the recipient's own", /Toman/.test(foreignBody) && !/Rial/.test(foreignBody), foreignBody.split('\n')[1] ?? '')
  await foreign.close()

  const shortcut = await open({ query: '?m=sell' })
  const selected = await shortcut.locator('[role="tab"][aria-selected="true"]').first().innerText()
  check('?m=sell shortcut opens the sell calculator', /Sell/.test(selected), selected)
  await shortcut.close()

  const v2 = await open({ query: '?m=profit&v=cost:100000,margin:20,months:3' })
  const v2body = await resultText(v2)
  check('v2 share link carries the lens', digits(v2body).includes('130530.88'))
  await v2.close()
})

await flow('products', async () => {
  const shortcut = await open({ query: '?tab=products' })
  check('?tab=products opens the products tab', /My products/.test(await shortcut.locator('body').innerText()))
  await shortcut.close()

  const page = await open()
  await fields(page).nth(0).fill('100000')
  await fields(page).nth(1).fill('20')
  await calc(page)
  await resultText(page)
  await page.getByRole('button', { name: /Save to my products/ }).click()
  await page.waitForTimeout(1000)
  await page.locator('[role="dialog"] input[type="text"]').fill('Blue mug')
  await page.locator('[role="dialog"]').getByRole('button', { name: /save/i }).last().click()
  await page.waitForTimeout(1400)
  await page.getByRole('tab', { name: /My products/ }).click()
  await page.waitForTimeout(1400)
  const list = await page.locator('body').innerText()
  check('saving a product lands it in the products tab', /Blue mug/.test(list), list.split('\n').slice(0, 5).join(' | '))
  await assertNoRawKeys(page, 'the products tab')
  await page.close()
})

await flow('drafts and what’s new', async () => {
  const page = await open()
  await fields(page).nth(0).fill('123456')
  await page.waitForTimeout(1000)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const restored = await fields(page).first().inputValue()
  check('draft input survives a reload', digits(restored) === '123456', restored)
  await page.close()

  // A v1.2.0 install has a unit but has never heard of sooda:last-version.
  const upgraded = await open({ storage: { 'sooda:unit': 'toman', 'sooda:last-version': undefined } })
  await upgraded.waitForTimeout(1200)
  const text = (await upgraded.locator('[role="dialog"]').count())
    ? await upgraded.locator('[role="dialog"]').innerText()
    : ''
  await assertNoRawKeys(upgraded, "What's New")
  check("What's New shows for an upgrading v1.2.0 user", /What’s new|What's new/i.test(text), text.split('\n')[0] ?? 'no dialog')
  await upgraded.close()

  const first = await open({ fresh: true })
  await first.waitForTimeout(1200)
  check("What's New stays hidden on a first install", !/What’s new|What's new/i.test(await first.locator('body').innerText()))
  await first.close()
})

/* A browser that refuses a database must cost the user their history and products — never the
 * calculator, which touches no storage at all. v1.4.0 got this wrong: one Dexie failure
 * replaced the entire screen with an error page. */
await flow('works with no database at all', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.addInitScript(() => {
    const boom = () => {
      const e = new Error('The operation is insecure.')
      e.name = 'SecurityError'
      throw e
    }
    Object.defineProperty(window, 'indexedDB', { get: boom, configurable: true })
  })
  await page.addInitScript((v) => {
    try {
      localStorage.setItem('sooda:lang', 'en')
      localStorage.setItem('sooda:last-version', v)
    } catch {
      /* storage may be refused too; the flow still has to pass */
    }
  }, APP_VERSION)
  await page.goto(`http://localhost:${PORT}${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  await fields(page).nth(0).fill('400000')
  await fields(page).nth(1).fill('20')
  await calc(page)
  const body = await resultText(page)
  check('no database: the calculator still computes', digits(body).includes('480000'))

  const all = await page.locator('body').innerText()
  check('no database: the app is not replaced by an error screen', !/can.t store anything/i.test(all))
  await page.close()
})

await runLearnFlows({ open, check, flow, browser, port: PORT, base: BASE })

await browser.close()
server.close()

printDurations()

const failed = checks.filter((c) => !c.ok).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed > 0 ? 1 : 0)
