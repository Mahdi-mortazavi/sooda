// Copies the public rates file into the bundle so a very first launch has figures to
// show before the network answers — an offline-first app that needs a fetch to say
// anything at all is not offline-first.
//
// Deliberately NOT wired as `prebuild`. The daily rates job commits public/data/rates.json
// to main, and main is what the Pages deploy builds; if that file were copied into the
// bundle on every build, each day's rate would change a content-hashed chunk, which would
// change the precache manifest in sw.js, which would prompt every installed device to
// update — daily, for a number the app fetches at runtime anyway. The served file is the
// live one; this bundled copy is only the floor a first launch stands on before any
// fetch answers, so it is refreshed deliberately at release time instead.
//
// Idempotent: an unchanged file is a no-op. Run it as part of a version bump.
// Usage: npm run rates:fallback
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO_ROOT, RATES_PATH, checkShape } from './update.mjs'

const DEST = resolve(REPO_ROOT, 'src/data/rates.fallback.json')

if (!existsSync(RATES_PATH)) {
  // Nothing to copy. If a bundled copy already exists the build is still sound, so this
  // is a warning rather than a stop.
  if (existsSync(DEST)) {
    console.warn(`⚠ ${RATES_PATH} is missing — keeping the existing src/data/rates.fallback.json`)
    process.exit(0)
  }
  console.error(`✗ ${RATES_PATH} is missing and there is no bundled fallback to fall back on`)
  process.exit(1)
}

let source
try {
  source = readFileSync(RATES_PATH, 'utf8')
  const parsed = JSON.parse(source)
  // A malformed rates.json must not be baked into the bundle, where no later fetch can
  // dislodge it. The writer in update.mjs makes this unreachable in practice.
  const shape = checkShape(parsed)
  if (!shape.ok) {
    console.error('✗ public/data/rates.json is not a valid rates file, refusing to bundle it:')
    for (const error of shape.errors) console.error(`  • ${error}`)
    process.exit(1)
  }
} catch (err) {
  console.error(`✗ cannot read public/data/rates.json: ${err.message}`)
  process.exit(1)
}

if (existsSync(DEST) && readFileSync(DEST, 'utf8') === source) {
  console.log('rates fallback already up to date')
  process.exit(0)
}

const tmp = `${DEST}.tmp`
writeFileSync(tmp, source, 'utf8')
renameSync(tmp, DEST)
console.log(`✓ src/data/rates.fallback.json ← public/data/rates.json`)
