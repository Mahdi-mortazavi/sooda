// Every worked example in README.md and README.fa.md, computed by the app's own engine.
//
// The point is that no number in the documentation is typed by hand or remembered. Run this,
// and the output is what the two READMEs must say. If an engine change moves a figure, this
// output moves with it and the mismatch is visible.
//
// Usage: npm run docs:examples            print every example
//        npm run docs:examples -- --check verify the READMEs still quote these numbers
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// The engine is TypeScript; bundle it once into a module this script can import.
const outdir = mkdtempSync(join(tmpdir(), 'sooda-docs-'))
const outfile = join(outdir, 'engine.mjs')
await build({
  entryPoints: ['scripts/docs-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
  // Vite-only globals the engine touches; the base path is what the deployed app uses.
  define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/sooda/' }) },
})
const e = await import(pathToFileURL(outfile).href)

/** Persian digits, so the numbers can be pasted straight into README.fa.md. */
const fa = (n, digits = 0) =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n)
const en = (n, digits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n)

const examples = []
const show = (id, note, pairs) => examples.push({ id, note, pairs })

/* ── the calculators ─────────────────────────────────────────────────────── */

const shawl = e.calcFromProfitPercent(400_000, 20)
show('profit', 'A shawl bought at 400,000 toman, sold at 20% profit', {
  'قیمت فروش / selling price': [fa(shawl.sellingPrice), en(shawl.sellingPrice)],
  'سود / profit': [fa(shawl.profitAmount), en(shawl.profitAmount)],
})

const fromPrice = e.calcFromSellingPrice(400_000, 480_000)
show('sell', 'The same shawl, priced at 480,000 — what margin is that?', {
  'درصد سود / profit percent': [fa(fromPrice.profitPercent, 2), en(fromPrice.profitPercent, 2)],
  'سود / profit': [fa(fromPrice.profitAmount), en(fromPrice.profitAmount)],
})

const off = e.calcDiscount(480_000, 15)
show('discount', '15% off a 480,000 price tag', {
  'قیمت نهایی / final price': [fa(off.finalPrice), en(off.finalPrice)],
  'مبلغ تخفیف / amount saved': [fa(off.savedAmount), en(off.savedAmount)],
})

const back = e.calcReverseDiscount(408_000, 15)
show('rdiscount', 'A 408,000 sale price that was 15% off — what was the original?', {
  'قیمت اصلی / original price': [fa(back.originalPrice), en(back.originalPrice)],
})

/* ── the real-profit lens ────────────────────────────────────────────────── */

const INFL = e.INFLATION_DEFAULT.annualPercent
const monthly = e.monthlyRateFromPercent(INFL)
const replacement = e.replacementCost(400_000, monthly, 3)
const realPct = e.realProfitPercent(shawl.sellingPrice, replacement)
show('lens', `The shawl was bought 3 months ago. Bundled inflation ${INFL}%/yr (${e.INFLATION_DEFAULT.updatedAt})`, {
  'نرخ ماهانه / monthly rate %': [fa(monthly * 100, 2), en(monthly * 100, 2)],
  'قیمت خرید دوباره / restock cost': [fa(replacement), en(replacement)],
  'سود واقعی / real profit %': [fa(realPct, 2), en(realPct, 2)],
  'وضعیت / status': [e.profitStatus(realPct, 20), e.profitStatus(realPct, 20)],
  'قیمت پیشنهادی / suggested price': [fa(e.suggestedPrice(replacement, 20)), en(e.suggestedPrice(replacement, 20))],
})

/* ── instalments ─────────────────────────────────────────────────────────── */

const fwd = e.calcInstallmentForward(10_000_000, 4_000_000, 6, monthly)
show('installment', '10,000,000 cash price, 4,000,000 down, 6 monthly payments', {
  'قسط ماهانه / monthly payment': [fa(fwd.installment), en(fwd.installment)],
  'جمع کل / total': [fa(fwd.total), en(fwd.total)],
  'گران‌تر از نقدی / markup %': [fa(fwd.markupPercent, 2), en(fwd.markupPercent, 2)],
  'سود ماهانهٔ ساده / flat monthly %': [fa(fwd.flatMonthlyPercent, 2), en(fwd.flatMonthlyPercent, 2)],
})

const rev = e.calcInstallmentReverse(10_000_000, 4_000_000, 6, 3, monthly)
show('rinstallment', 'The same plan offered at a flat 3%/month — is it actually profitable?', {
  'قسط ماهانه / monthly payment': [fa(rev.installment), en(rev.installment)],
  'ارزش امروز / value today': [fa(rev.presentValue), en(rev.presentValue)],
  'سود واقعی / real gain %': [fa(rev.realGainPercent, 2), en(rev.realGainPercent, 2)],
})

/* ── my products ─────────────────────────────────────────────────────────── */

const now = Date.UTC(2026, 8, 15)
const product = {
  id: 1,
  name: 'شال',
  cost: 400_000,
  targetMarginPercent: 20,
  price: 480_000,
  /* Exactly three Persian months back, via the app's own calendar arithmetic. A mean-length
   * month would land mid-month and productStatus counts whole months, so the products example
   * would silently disagree with the lens example above it. */
  costUpdatedAt: e.addMonths(now, -3),
  createdAt: now,
  updatedAt: now,
}
const status = e.productStatus(product, INFL, now)
show('products', 'The saved shawl, three months after its cost was last recorded', {
  'قیمت خرید دوباره / restock cost': [fa(status.replacement), en(status.replacement)],
  'حاشیهٔ واقعی / real margin %': [fa(status.realMarginPercent, 2), en(status.realMarginPercent, 2)],
  'نشان سلامت / health': [status.health, status.health],
})

show('rounding', 'Rounding the suggested price up to the nearest 5,000 (never down — margin is never lost)', {
  'بدون رند / unrounded': [fa(e.suggestedPrice(status.replacement, 20), 2), en(e.suggestedPrice(status.replacement, 20), 2)],
  'رند شده / rounded up': [
    fa(e.roundUpTo(e.suggestedPrice(status.replacement, 20), 5000)),
    en(e.roundUpTo(e.suggestedPrice(status.replacement, 20), 5000)),
  ],
})

/* ── the smart rate ──────────────────────────────────────────────────────── */

const MONTH = 30.436875 * 86_400_000
const observations = [
  { cost: 320_000, observedAt: now - 6 * MONTH },
  { cost: 355_000, observedAt: now - 3 * MONTH },
  { cost: 400_000, observedAt: now - 1 * MONTH },
]
const rate = e.productRate({
  observations,
  category: 'apparel',
  importDependency: 0,
  rates: e.FALLBACK_RATES,
  now,
})
show('rate', 'Three purchase prices recorded over six months, no national figures yet (the shipped state)', {
  'نرخ ماهانه / monthly rate %': [
    rate.monthlyPercent === null ? '—' : fa(rate.monthlyPercent, 2),
    rate.monthlyPercent === null ? '—' : en(rate.monthlyPercent, 2),
  ],
  'سهم قیمت‌های خودتان / your own share %': [fa(rate.lambda * 100, 0), en(rate.lambda * 100, 0)],
  'دقت تخمین / confidence': [rate.confidence, rate.confidence],
  'قیمت خرید امروز / restock now': [
    rate.replacementNow === null ? '—' : fa(rate.replacementNow),
    rate.replacementNow === null ? '—' : en(rate.replacementNow),
  ],
})

/* ── output ──────────────────────────────────────────────────────────────── */

const flat = []
for (const ex of examples) {
  console.log(`\n■ ${ex.id} — ${ex.note}`)
  for (const [label, [f, n]] of Object.entries(ex.pairs)) {
    console.log(`    ${label.padEnd(42)} fa ${String(f).padStart(14)}   en ${String(n).padStart(14)}`)
    flat.push([ex.id, label, String(f), String(n)])
  }
}

if (process.argv.includes('--check')) {
  // Guards the promise that the docs quote the engine: every figure above must appear verbatim
  // in the README of its own language.
  const faDoc = readFileSync('README.fa.md', 'utf8')
  const enDoc = readFileSync('README.md', 'utf8')
  /* Compare magnitudes only. Intl prefixes a bidi mark to a negative Persian number and the
   * prose says "۰٫۹۶٪ زیان" rather than repeating the sign, so the sign is not what we are
   * checking — the digits are. Values with no digits at all (a status word like `thin`) are
   * enum names, not figures, and are rendered as translated prose in each language. */
  const magnitude = (v) => v.replace(/[\u200e\u200f\u061c]/g, '').replace(/^[-−]/, '')
  const missing = []
  for (const [id, label, f, n] of flat) {
    if (!/\d|[۰-۹]/.test(f)) continue
    const fm = magnitude(f)
    const nm = magnitude(n)
    if (!faDoc.includes(fm)) missing.push(`README.fa.md is missing ${id} → ${label} = ${fm}`)
    if (!enDoc.includes(nm)) missing.push(`README.md is missing ${id} → ${label} = ${nm}`)
  }
  console.log('')
  if (missing.length > 0) {
    for (const m of missing) console.error(`✗ ${m}`)
    console.error(`\n${missing.length} documented figure(s) do not match the engine.`)
    process.exit(1)
  }
  console.log('✓ every engine figure above appears in the README of its language')
}
