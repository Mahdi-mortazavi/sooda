// Renders the 1200×630 Open Graph image with the real app fonts via headless Chromium.
// Run: node scripts/generate-og.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const b64 = async (p) => (await readFile(join(root, p))).toString('base64')

const inter = await b64('src/assets/fonts/Inter-Variable.woff2')
const vazir = await b64('src/assets/fonts/Vazirmatn-Variable.woff2')
const icon = await b64('scripts/icon.svg')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter}) format('woff2-variations'); font-weight: 100 900; }
  @font-face { font-family: Vazirmatn; src: url(data:font/woff2;base64,${vazir}) format('woff2-variations'); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden; position: relative;
    font-family: Inter, sans-serif; color: #f5f5f7;
    background: linear-gradient(135deg, #04211b 0%, #072e25 45%, #0a4636 100%);
    display: flex; align-items: center; justify-content: center; gap: 72px;
  }
  .blob { position: absolute; border-radius: 999px; filter: blur(90px); }
  .card {
    position: relative; display: flex; align-items: center; gap: 56px;
    padding: 64px 88px; border-radius: 48px;
    background: rgba(255,255,255,0.07);
    border: 1.5px solid rgba(255,255,255,0.22);
    box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.3), 0 40px 90px rgba(0,0,0,0.45);
    backdrop-filter: blur(30px) saturate(1.6);
  }
  h1 { font-size: 110px; font-weight: 800; letter-spacing: -3px; line-height: 1; }
  .fa { font-family: Vazirmatn, sans-serif; font-size: 44px; font-weight: 600; color: #7fe8c8; margin-top: 10px; }
  .tag { font-size: 34px; font-weight: 500; color: rgba(245,245,247,0.85); margin-top: 22px; letter-spacing: -0.5px; }
  .chips { display: flex; gap: 14px; margin-top: 34px; }
  .chip {
    font-size: 21px; font-weight: 600; padding: 10px 22px; border-radius: 999px;
    background: rgba(127,232,200,0.14); color: #7fe8c8; border: 1px solid rgba(127,232,200,0.35);
  }
  img { width: 300px; height: 300px; filter: drop-shadow(0 24px 48px rgba(0,0,0,0.45)); }
</style></head><body>
  <div class="blob" style="width:560px;height:560px;top:-220px;left:-140px;background:rgba(34,197,151,0.4)"></div>
  <div class="blob" style="width:480px;height:480px;bottom:-200px;right:-100px;background:rgba(45,212,191,0.28)"></div>
  <div class="card">
    <img src="data:image/svg+xml;base64,${icon}" alt="">
    <div>
      <h1>Sooda <span style="font-family:Vazirmatn;font-weight:700">سودا</span></h1>
      <div class="tag">Profit math, crystal clear.</div>
      <div class="fa">سود و قیمت، شفاف مثل شیشه</div>
      <div class="chips">
        <span class="chip">Offline-first PWA</span>
        <span class="chip">EN / فارسی</span>
        <span class="chip">Privacy-first</span>
      </div>
    </div>
  </div>
</body></html>`

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.screenshot({ path: join(root, 'public', 'og.png') })
await browser.close()
console.log('✓ public/og.png')
