// Records official Iranian CPI figures by hand. amar.org.ir and cbi.ir refuse
// connections from non-Iranian addresses, so a human reads the monthly release and
// types the numbers in here.
//
// Shares every sanity check and the single writer in update.mjs. Exits non-zero on a
// bad input, because a mistyped official figure is a maintainer error, not a bad
// upstream day.
//
// Usage: npm run rates:cpi -- --category apparel --monthly 2.9
//        npm run rates:cpi -- --overall 3.4 --as-of 2026-08
//        npm run rates:cpi -- --overall 3.4 --as-of 2026-08 --source-name "…" --source-url https://…
import { CPI_CATEGORIES, applyUpdate, readFlag, readRates, writeRates, RATES_PATH } from './update.mjs'

function fail(message) {
  console.error(`✗ ${message}`)
  console.error('  usage: npm run rates:cpi -- [--category <id> --monthly <percent>] [--overall <percent>]')
  console.error('                             [--as-of YYYY-MM] [--source-name N] [--source-url U] [--dry-run]')
  console.error(`  categories: ${CPI_CATEGORIES.join(' ')}`)
  process.exit(1)
}

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')

let category
let monthly
let overall
let asOf
let sourceName
let sourceUrl
let ratesPath
try {
  category = readFlag(argv, '--category')
  monthly = readFlag(argv, '--monthly')
  overall = readFlag(argv, '--overall')
  asOf = readFlag(argv, '--as-of')
  sourceName = readFlag(argv, '--source-name')
  sourceUrl = readFlag(argv, '--source-url')
  ratesPath = readFlag(argv, '--file') ?? RATES_PATH
} catch (err) {
  fail(err.message)
}

const nothingGiven = [category, overall, asOf, sourceName, sourceUrl].every((v) => v === undefined)
if (nothingGiven) {
  fail('nothing to do — pass --category/--monthly, --overall, --as-of or a --source-*')
}

const categories = {}
if (category !== undefined) {
  // 'other' is a real merchant category in the app but has no CPI division of its own:
  // it falls back to the overall index, so storing a figure against it would be a lie.
  if (category === 'other') {
    fail("'other' is not a CPI category — it falls back to the overall index, so set --overall instead")
  }
  if (!CPI_CATEGORIES.includes(category)) {
    fail(`'${category}' is not a category id — expected one of: ${CPI_CATEGORIES.join(' ')}`)
  }
  if (monthly === undefined) fail('--category needs --monthly <percent>')
  const value = Number(monthly)
  if (!Number.isFinite(value)) fail(`--monthly must be a finite number, got ${JSON.stringify(monthly)}`)
  categories[category] = value
} else if (monthly !== undefined) {
  fail('--monthly needs --category <id>')
}

const incoming = { categories }
if (overall !== undefined) {
  const value = Number(overall)
  if (!Number.isFinite(value)) fail(`--overall must be a finite number, got ${JSON.stringify(overall)}`)
  incoming.overallMonthlyPercent = value
}
if (asOf !== undefined) incoming.asOf = asOf
if (sourceName !== undefined || sourceUrl !== undefined) incoming.source = { name: sourceName, url: sourceUrl }

const current = readRates(ratesPath)
const applied = applyUpdate(current, { cpi: incoming }, {})

if (!applied.ok) {
  console.error('✗ rejected — public/data/rates.json left untouched:')
  for (const error of applied.errors) console.error(`  • ${error}`)
  process.exit(1)
}
if (applied.changes.length === 0) {
  console.log('rates already record these figures — nothing to write')
  process.exit(0)
}
for (const change of applied.changes) console.log(`  • ${change}`)
if (dryRun) {
  console.log('--dry-run: nothing written')
  process.exit(0)
}
writeRates(applied.next, ratesPath)
console.log(`✓ wrote ${ratesPath} (updatedAt ${applied.next.updatedAt})`)
