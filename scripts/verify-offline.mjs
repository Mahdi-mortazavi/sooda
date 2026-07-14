// Verifies the PWA works offline: registers the SW, kills the network, reloads,
// and checks the app still renders and calculates.
// Usage: node scripts/verify-offline.mjs [url]   (defaults to the local dist server)
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://localhost:4173/sooda/'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

console.log(`→ loading ${url}`)
await page.goto(url, { waitUntil: 'networkidle' })

const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready
  return { scope: reg.scope, active: !!reg.active }
})
console.log(`✓ service worker active (scope: ${swState.scope})`)

// Give Workbox a beat to finish precaching, then verify the precache exists.
await page.waitForTimeout(2500)
const cacheInfo = await page.evaluate(async () => {
  const names = await caches.keys()
  let total = 0
  for (const n of names) total += (await (await caches.open(n)).keys()).length
  return { names, total }
})
console.log(`✓ caches: ${cacheInfo.names.join(', ')} (${cacheInfo.total} entries)`)
if (cacheInfo.total < 10) throw new Error('precache looks incomplete')

await context.setOffline(true)
console.log('→ network disabled, reloading…')
await page.reload({ waitUntil: 'load' })

const title = await page.title()
const heading = await page.locator('h1').textContent()
console.log(`✓ offline reload OK — title="${title}", h1="${heading}"`)

// Prove the app is actually interactive offline: run a calculation.
const inputs = page.locator('main input')
await inputs.nth(0).fill('100')
await inputs.nth(1).fill('25')
await page.getByRole('button', { name: /Calculate|محاسبه/ }).click()
await page.waitForTimeout(1200)
const result = await page.locator('[role="status"]').first().textContent()
if (!result || !result.includes('125')) throw new Error(`unexpected offline calc result: ${result}`)
console.log(`✓ offline calculation works: "${result.trim()}"`)

await browser.close()
console.log('\nOFFLINE VERIFICATION PASSED')
