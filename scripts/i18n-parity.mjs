// Keeps en.json and fa.json structurally identical: a key that exists in only one
// language ships as a raw i18next path to half the users, and nobody notices until
// a screenshot comes back in the wrong language.
// Usage: node scripts/i18n-parity.mjs
import { readFileSync } from 'node:fs'

// Two bundles ship separately: the core one loads on first paint, the sheets one
// rides along with the first lazily-loaded sheet. Both must be in parity, and a key
// must not appear in both or the deep merge would silently pick a winner.
const BUNDLES = [
  { name: 'core', en: 'src/i18n/en.json', fa: 'src/i18n/fa.json' },
  { name: 'sheets', en: 'src/i18n/sheets/en.json', fa: 'src/i18n/sheets/fa.json' },
]

function load(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`✗ cannot read ${path}: ${err.message}`)
    process.exit(1)
  }
}

/** Flattens to leaf path → value. Arrays are leaves: order and length matter for things like CSV headers. */
function flatten(node, prefix, out) {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out)
    }
    return out
  }
  out.set(prefix, node)
  return out
}

function kindOf(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

export function compare(en, fa) {
  const left = flatten(en, '', new Map())
  const right = flatten(fa, '', new Map())
  const missingInFa = [...left.keys()].filter((k) => !right.has(k)).sort()
  const missingInEn = [...right.keys()].filter((k) => !left.has(k)).sort()
  const typeMismatch = []
  const lengthMismatch = []
  const empty = []

  for (const [key, value] of [...left].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!right.has(key)) continue
    const other = right.get(key)
    if (kindOf(value) !== kindOf(other)) {
      typeMismatch.push(`${key}: en is ${kindOf(value)}, fa is ${kindOf(other)}`)
      continue
    }
    if (Array.isArray(value) && value.length !== other.length) {
      lengthMismatch.push(`${key}: en has ${value.length} items, fa has ${other.length}`)
    }
  }

  for (const [lang, map] of [['en', left], ['fa', right]]) {
    for (const [key, value] of [...map].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (typeof value === 'string' && value.trim() === '') empty.push(`${lang}:${key}`)
      if (Array.isArray(value) && value.some((v) => typeof v === 'string' && v.trim() === '')) {
        empty.push(`${lang}:${key}[]`)
      }
    }
  }

  return { total: left.size, missingInFa, missingInEn, typeMismatch, lengthMismatch, empty }
}

function report(name, result) {
  const sections = [
    [`${name}: missing in fa.json (present in en.json)`, result.missingInFa],
    [`${name}: missing in en.json (present in fa.json)`, result.missingInEn],
    ['type mismatch', result.typeMismatch],
    ['array length mismatch', result.lengthMismatch],
    ['empty values', result.empty],
  ].filter(([, items]) => items.length > 0)

  if (sections.length === 0) {
    console.log(`✓ ${name}: ${result.total} keys, in parity`)
    return 0
  }

  for (const [title, items] of sections) {
    console.error(`\n${title} (${items.length}):`)
    for (const item of items) console.error(`  • ${item}`)
  }
  const count = sections.reduce((sum, [, items]) => sum + items.length, 0)
  console.error(`\n✗ ${name}: i18n parity failed — ${count} finding(s) across ${result.total} en keys`)
  return 1
}

/** A key in both bundles would be resolved by load order rather than by intent. */
function reportOverlap(bundles) {
  const [core, sheets] = bundles
  const overlap = [...core.keys()].filter((k) => sheets.has(k)).sort()
  if (overlap.length === 0) return 0
  console.error(`\nkeys defined in both the core and sheets bundles (${overlap.length}):`)
  for (const key of overlap) console.error(`  • ${key}`)
  return 1
}

// Importable for testing; only the direct run exits the process.
if (import.meta.url === `file://${process.argv[1]}`) {
  let status = 0
  const keySets = []
  for (const bundle of BUNDLES) {
    const en = load(bundle.en)
    status |= report(bundle.name, compare(en, load(bundle.fa)))
    keySets.push(flatten(en, '', new Map()))
  }
  status |= reportOverlap(keySets)
  process.exit(status)
}
