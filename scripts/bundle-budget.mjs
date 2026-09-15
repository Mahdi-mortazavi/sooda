// Guards the first-paint payload against silent growth: more bytes before first paint
// is a slower start on the 3G phones this app is built for.
//
// v1.3 moved translations out of the entry into one chunk per language, so the entry
// alone would understate what a user actually downloads. The budget is therefore
// enforced on entry + the largest language chunk — the worst case any single user pays.
// Usage: node scripts/bundle-budget.mjs [--json]   (run after `npm run build`)
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Measured on the v1.2.0 build with this script's own gzip, so the comparison is
// like-for-like — see docs/v1.3-baseline.md. (GNU `gzip -9` reads ~480 B lower on
// the same bytes; do not mix the two numbers.)
const BASELINE_GZIP_BYTES = 123061
const CEILING_GZIP_BYTES = 126133 // baseline + 3 KiB of head-room for v1.3

const json = process.argv.includes('--json')
const dist = 'dist'
const assets = join(dist, 'assets')

function fail(message) {
  if (json) console.log(JSON.stringify({ ok: false, error: message }, null, 2))
  else console.error(`✗ ${message}`)
  process.exit(1)
}

if (!existsSync(dist)) fail('dist/ is missing — run `npm run build` first')
if (!existsSync(assets)) fail('dist/assets/ is missing — the build did not finish')

/** Raw + gzip(-9) size of one file; gzip level 9 matches what the baseline was measured with. */
function measure(path) {
  const buf = readFileSync(path)
  return { path, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
}

const files = readdirSync(assets)
  .filter((name) => name.endsWith('.js'))
  .sort()
  .map((name) => measure(join(assets, name)))

const indexHtml = join(dist, 'index.html')
if (existsSync(indexHtml)) files.push(measure(indexHtml))

const entry = files.find((f) => /[\\/]index-[^\\/]+\.js$/.test(f.path))
if (!entry) fail('no entry chunk matched dist/assets/index-*.js')

// One of these loads on every first paint; the biggest one is the worst case.
const langChunks = files.filter((f) => /[\\/](en|fa)-[^\\/]+\.js$/.test(f.path))
if (langChunks.length === 0) fail('no language chunk matched dist/assets/{en,fa}-*.js')
const worstLang = langChunks.reduce((a, b) => (b.gzip > a.gzip ? b : a))

const initial = entry.gzip + worstLang.gzip
const delta = initial - BASELINE_GZIP_BYTES
const over = initial > CEILING_GZIP_BYTES

if (json) {
  console.log(
    JSON.stringify(
      {
        ok: !over,
        baseline: BASELINE_GZIP_BYTES,
        ceiling: CEILING_GZIP_BYTES,
        entry: { file: entry.path, raw: entry.raw, gzip: entry.gzip },
        language: { file: worstLang.path, gzip: worstLang.gzip },
        initial: { gzip: initial, delta },
        files,
      },
      null,
      2,
    ),
  )
} else {
  const n = (v) => v.toLocaleString('en-US')
  const width = Math.max(...files.map((f) => f.path.length))
  console.log('file'.padEnd(width) + '  ' + 'raw'.padStart(10) + '  ' + 'gzip -9'.padStart(10))
  console.log('-'.repeat(width + 24))
  for (const f of files) {
    console.log(f.path.padEnd(width) + '  ' + n(f.raw).padStart(10) + '  ' + n(f.gzip).padStart(10))
  }
  const sign = delta >= 0 ? '+' : '−'
  console.log(`\nentry            ${entry.path}: ${n(entry.gzip)} B gzip`)
  console.log(`worst language   ${worstLang.path}: ${n(worstLang.gzip)} B gzip`)
  console.log(
    `first paint      ${n(initial)} B gzip ` +
      `(baseline ${n(BASELINE_GZIP_BYTES)}, ${sign}${n(Math.abs(delta))}, ceiling ${n(CEILING_GZIP_BYTES)})`,
  )
}

if (over) {
  if (!json) {
    console.error(
      `\n✗ first-paint payload is ${(initial - CEILING_GZIP_BYTES).toLocaleString('en-US')} B over the ${CEILING_GZIP_BYTES.toLocaleString('en-US')} B ceiling.\n` +
        '  Move the new surface into a lazy chunk, or raise the budget in docs/v1.3-baseline.md deliberately.',
    )
  }
  process.exit(1)
}

if (!json) console.log('✓ first-paint payload within budget')
