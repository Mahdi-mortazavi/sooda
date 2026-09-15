// Records one free-market USD→Toman close by hand. This is the route that will actually
// be used day to day, because no Iranian FX source ships a documented public API.
//
// It shares every sanity check and the single writer in update.mjs, so a typed-in figure
// can never produce a file the automated path would have rejected. Unlike the automated
// path it exits non-zero on failure: a maintainer's typo deserves a red terminal.
//
// Usage: npm run rates:set -- --fx 1042000 --date 2026-09-15
//        npm run rates:set -- --fx 1042000 --date 2026-09-15 --source-name TGJU --source-url https://…
//        npm run rates:set -- --fx 1042000 --date 2026-09-15 --dry-run
import { applyUpdate, readFlag, readRates, todayUtc, writeRates, RATES_PATH } from './update.mjs'

function fail(message) {
  console.error(`✗ ${message}`)
  console.error('  usage: npm run rates:set -- --fx <toman> [--date YYYY-MM-DD]')
  console.error('                             [--source-name N] [--source-url U] [--dry-run]')
  process.exit(1)
}

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')

let raw
let date
let sourceName
let sourceUrl
try {
  raw = readFlag(argv, '--fx')
  date = readFlag(argv, '--date') ?? todayUtc()
  sourceName = readFlag(argv, '--source-name')
  sourceUrl = readFlag(argv, '--source-url')
} catch (err) {
  fail(err.message)
}

if (raw === undefined) fail('--fx is required (the rate in toman, e.g. --fx 1042000)')
const rate = Number(raw)
if (!Number.isFinite(rate) || rate <= 0) fail(`--fx must be a finite number > 0, got ${JSON.stringify(raw)}`)

const ratesPath = (() => {
  try {
    return readFlag(argv, '--file') ?? RATES_PATH
  } catch (err) {
    return fail(err.message)
  }
})()

const source = sourceName !== undefined || sourceUrl !== undefined ? { name: sourceName, url: sourceUrl } : undefined
const current = readRates(ratesPath)
const applied = applyUpdate(current, { fx: { points: [[date, rate]], source } }, {})

if (!applied.ok) {
  console.error('✗ rejected — public/data/rates.json left untouched:')
  for (const error of applied.errors) console.error(`  • ${error}`)
  process.exit(1)
}
if (applied.changes.length === 0) {
  console.log(`rates already record ${rate} for ${date} — nothing to write`)
  process.exit(0)
}
for (const change of applied.changes) console.log(`  • ${change}`)
if (dryRun) {
  console.log('--dry-run: nothing written')
  process.exit(0)
}
writeRates(applied.next, ratesPath)
console.log(`✓ wrote ${ratesPath} (updatedAt ${applied.next.updatedAt})`)
