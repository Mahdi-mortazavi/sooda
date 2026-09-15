// Every figure the eight lessons check an answer against, computed by the app's own engine.
//
// Same promise `docs-examples.mjs` makes the READMEs, made to the tutorial: no number a learner
// is marked against is typed by hand or remembered. This script bundles the real engine, runs the
// lessons' own `expected.source.ts` against it at the pinned tutorial rate, and either prints the
// answers, writes the snapshot the lessons import, or fails because the snapshot has gone stale.
//
// Usage: node scripts/lesson-examples.mjs            print every challenge answer
//        node scripts/lesson-examples.mjs --write    rewrite src/learn/lessons/expected.generated.ts
//        node scripts/lesson-examples.mjs --check    fail if that file no longer matches the engine
//
// There is no npm script for it yet — `lessons` may not edit package.json. Suggested:
//   "lesson:examples": "node scripts/lesson-examples.mjs"
import { build } from 'esbuild'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const GENERATED = 'src/learn/lessons/expected.generated.ts'

const write = process.argv.includes('--write')
const check = process.argv.includes('--check')

if (check && !existsSync(GENERATED)) {
  console.error(`✗ ${GENERATED} does not exist — run \`node scripts/lesson-examples.mjs --write\` first.`)
  process.exit(1)
}

/* The engine is TypeScript. Bundle it through a synthetic entry point rather than a checked-in
 * one: `lessons` owns this script and `src/learn/lessons/**` and nothing else, and a re-export
 * file under `scripts/` would be somebody else's to review. */
const entry = [
  `export { computeLessonExpected, computeLessonInputs, PINNED_NOW } from './src/learn/lessons/expected.source'`,
  check ? `export * as snapshot from './${GENERATED.replace(/\.ts$/, '')}'` : '',
].join('\n')

const outfile = join(mkdtempSync(join(tmpdir(), 'sooda-lessons-')), 'engine.mjs')
await build({
  stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'lesson-examples-entry.ts', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
  // Vite-only globals the engine touches; the base path is what the deployed app uses.
  define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/sooda/' }) },
})
const e = await import(pathToFileURL(outfile).href)

const expected = e.computeLessonExpected()
const inputs = e.computeLessonInputs()

/* Pinned or not, an answer that moves with the clock is a bug in the lesson rather than in the
 * engine, and it would only ever show up months later. Prove it here instead. */
const later = e.computeLessonExpected(e.PINNED_NOW + 97 * 86_400_000)
if (JSON.stringify(later) !== JSON.stringify(expected)) {
  console.error('✗ a challenge answer changed when only the clock moved:')
  console.error(`    at PINNED_NOW        ${JSON.stringify(expected)}`)
  console.error(`    97 days later        ${JSON.stringify(later)}`)
  process.exit(1)
}

/* ── printing ─────────────────────────────────────────────────────────── */

const fa = (n) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(n)
const en = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
const show = (label, value) => {
  const rendered = typeof value === 'number' ? `${String(fa(value)).padStart(16)}   en ${en(value)}` : String(value)
  console.log(`    ${label.padEnd(38)} ${typeof value === 'number' ? 'fa ' : ''}${rendered}`)
}

console.log(`\n■ pinned for every lesson: ${e.PINNED_NOW ? '' : ''}3%/month, rounding up to 1,000`)

console.log('\n■ mission 1 — bought at 100,000, wants 20%, then three months on')
show('قیمت فروش / selling price', expected.mission.sellingPrice)
show('سود / profit', expected.mission.profitAmount)
show('خرید دوباره / restock cost', expected.mission.replacement)
show('سود واقعی ٪ / real profit %', expected.mission.realPercent)
show('حکم / verdict', expected.mission.verdict)
show('قیمت پیشنهادی / suggested price', expected.mission.suggested)

console.log('\n■ profit — bought at 150,000, wants 25%')
show('قیمت فروش / selling price', expected.profit.sellingPrice)
show('سود / profit', expected.profit.profitAmount)

console.log('\n■ discount — 30% off 500,000, then back again')
show('قیمت با تخفیف / price after', expected.discount.finalPrice)
show('قیمت اصلی / original price', expected.discount.originalPrice)

console.log('\n■ realProfit — the demo shop’s oil, three months on')
show('خرید دوباره / restock cost', expected.realProfit.replacement)
show('سود واقعی ٪ / real profit %', expected.realProfit.realPercent)
show('حکم / verdict', expected.realProfit.verdict)

console.log('\n■ installments — 12,000,000 over 6 months, nothing down')
show('قسط ماهانه / monthly payment', expected.installments.monthly)
show('جمع کل / total', expected.installments.total)
show('سود واقعی ٪ / real gain % (flat 2%)', expected.installments.reverseGainPercent)
show('حکم / verdict', expected.installments.reverseVerdict)

console.log(`\n■ products — every purchase price up ${expected.products.costUpPercent}%`)
for (const row of expected.products.newCosts) show(`کالای ${row.id} / product ${row.id}`, row.cost)

console.log('\n■ smartRates — rows the check-in challenge must look past')
show('ردیف‌های آماده / seeded readings', expected.smartRates.seedObservationCount)

console.log('\n■ everyday — the two basket lines together')
show('سود مجموع / combined profit', expected.everyday.combinedProfit)

console.log('\n■ typed in by the lessons (derived, not invented)')
for (const [lesson, values] of Object.entries(inputs)) {
  for (const [key, value] of Object.entries(values)) show(`${lesson}.${key}`, value)
}

/* ── the snapshot ─────────────────────────────────────────────────────── */

const file = `/*
 * GENERATED — \`node scripts/lesson-examples.mjs --write\`. Do not edit by hand.
 *
 * Every figure below came out of the app's own engine at the pinned tutorial rate. The lessons
 * import this file rather than the engine, so opening a lesson does not drag the calculators,
 * the bulk preview and the basket adder into the tutorial chunk — and \`--check\`, plus
 * \`expected.test.ts\`, fail the moment the engine and this snapshot disagree.
 */

import type { LessonExpected, LessonInputs } from './types'

export const LESSON_EXPECTED: LessonExpected = ${JSON.stringify(expected, null, 2)}

export const LESSON_INPUTS: LessonInputs = ${JSON.stringify(inputs, null, 2)}
`

if (write) {
  writeFileSync(GENERATED, file)
  console.log(`\n✓ wrote ${GENERATED}`)
}

if (check) {
  const problems = []
  const compare = (what, mine, theirs) => {
    const a = JSON.stringify(mine, null, 2)
    const b = JSON.stringify(theirs, null, 2)
    if (a !== b) problems.push(`${what}\n  engine   ${a.replace(/\n/g, '\n  ')}\n  lessons  ${b.replace(/\n/g, '\n  ')}`)
  }
  compare('LESSON_EXPECTED', expected, e.snapshot.LESSON_EXPECTED)
  compare('LESSON_INPUTS', inputs, e.snapshot.LESSON_INPUTS)
  /* The committed text is compared too, not just the values: a snapshot that is right but was
   * hand-edited is a snapshot somebody will hand-edit again, less carefully. */
  if (readFileSync(GENERATED, 'utf8') !== file) {
    problems.push(`${GENERATED} is not what --write would produce (hand-edited, or the writer changed).`)
  }
  console.log('')
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`)
    console.error(`\n${problems.length} mismatch(es). Run \`node scripts/lesson-examples.mjs --write\`.`)
    process.exit(1)
  }
  console.log('✓ every lesson answer still matches the engine')
}
