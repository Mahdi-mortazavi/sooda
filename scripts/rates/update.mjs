// The rates pipeline: asks the configured adapters for new CPI / FX data, runs every
// sanity check, and rewrites public/data/rates.json only when all of them pass.
//
// This file is also the single writer for the manual tools (set.mjs, cpi.mjs), so a
// hand-entered figure can never produce a file the automated path would have rejected.
// A bad upstream day must not turn the repo red: on failure it prints a ::warning::
// annotation, writes nothing, and exits 0.
//
// Usage: node scripts/rates/update.mjs [--dry-run] [--fx-only|--cpi-only] [--config PATH] [--file PATH]
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..')
export const RATES_PATH = resolve(REPO_ROOT, 'public/data/rates.json')
export const CONFIG_PATH = resolve(HERE, 'config.json')

// Mirrors CATEGORY_IDS in src/lib/rates/categories.ts minus 'other', which has no CPI
// division of its own. Duplicated because this is plain Node ESM and that file is TS;
// src/lib/rates/schema.test.ts is where the two are kept honest.
export const CPI_CATEGORIES = ['food', 'apparel', 'home', 'digital', 'beauty', 'health', 'auto', 'stationery']

/** A day-on-day move larger than this is far more likely a source bug than a real market. */
export const MAX_FX_JUMP = 0.25
/** Enough history for a year-plus of trend without letting the file grow without bound. */
export const FX_WINDOW_DAYS = 400
/** A monthly CPI print outside this band is not a plausible official figure. */
export const CPI_MIN_PERCENT = -5
export const CPI_MAX_PERCENT = 30

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/
const DAY_MS = 86400000

/** Strict calendar parse: rejects '2026-02-30' and anything not exactly YYYY-MM-DD. */
export function parseDay(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null
  const ms = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null
}

export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveNumber(value) {
  return isNumber(value) && value > 0
}

/**
 * Merges new FX points into the existing series, rejecting anything implausible.
 * Pure: it never touches disk and never mutates its arguments.
 *
 * @param {[string, number][]} existing  the stored series, any order
 * @param {[string, number][]} incoming  candidate points
 * @returns {{ ok: true, series: [string, number][], added: [string, number][], unchanged: string[] }
 *          | { ok: false, errors: string[] }}
 */
export function mergeFx(existing, incoming, options = {}) {
  const windowDays = options.windowDays ?? FX_WINDOW_DAYS
  const maxJump = options.maxJump ?? MAX_FX_JUMP
  const errors = []
  const byDate = new Map()

  for (const point of existing ?? []) {
    if (!Array.isArray(point) || point.length !== 2) {
      errors.push(`stored series has a malformed point: ${JSON.stringify(point)}`)
      continue
    }
    const [date, rate] = point
    if (parseDay(date) === null) errors.push(`stored series has a bad date: ${JSON.stringify(date)}`)
    else if (!isPositiveNumber(rate)) errors.push(`stored series has a bad rate for ${date}: ${JSON.stringify(rate)}`)
    else byDate.set(date, rate)
  }

  const added = []
  const unchanged = []
  for (const point of incoming ?? []) {
    if (!Array.isArray(point) || point.length !== 2) {
      errors.push(`incoming point is not a [date, rate] pair: ${JSON.stringify(point)}`)
      continue
    }
    const [date, rate] = point
    if (parseDay(date) === null) {
      errors.push(`incoming date is not a real YYYY-MM-DD day: ${JSON.stringify(date)}`)
      continue
    }
    if (!isPositiveNumber(rate)) {
      errors.push(`incoming rate for ${date} is not a finite number > 0: ${JSON.stringify(rate)}`)
      continue
    }
    if (byDate.has(date)) {
      // Re-publishing the same close is routine; a different close for a day we already
      // shipped means one of the two is wrong, and guessing which is not our call.
      const stored = byDate.get(date)
      if (stored === rate) unchanged.push(date)
      else errors.push(`${date} already stored as ${stored} but upstream now says ${rate} — refusing to overwrite`)
      continue
    }
    byDate.set(date, rate)
    added.push([date, rate])
  }

  if (errors.length > 0) return { ok: false, errors }

  const series = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  // Every adjacency that a new point takes part in is checked, on both sides. Guarding
  // only the left neighbour would let a back-filled point sit next to an existing one it
  // contradicts by 300% and still pass, because the discontinuity would land on a pair
  // where neither side is "new". Existing pairs are left alone, so this can only reject
  // series the pipeline is about to make worse.
  const addedDates = new Set(added.map(([date]) => date))
  for (let i = 1; i < series.length; i += 1) {
    const [date, rate] = series[i]
    const [prevDate, prevRate] = series[i - 1]
    if (!addedDates.has(date) && !addedDates.has(prevDate)) continue
    const move = Math.abs(rate - prevRate) / prevRate
    if (move > maxJump) {
      const pct = (move * 100).toFixed(1)
      errors.push(`${date} at ${rate} is ${pct}% from ${prevDate} at ${prevRate} — over the ${maxJump * 100}% limit`)
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  // Trimmed only after every check, so dropping old points can never hide a rejection.
  // Anchored on the newest point rather than on today: a stale upstream should not
  // silently erode the history we already have.
  const trimmed = trimFx(series, windowDays)
  return { ok: true, series: trimmed, added, unchanged }
}

/** Keeps the points falling inside the last `windowDays` calendar days of the newest point. */
export function trimFx(series, windowDays = FX_WINDOW_DAYS) {
  if (series.length === 0) return []
  const newest = parseDay(series[series.length - 1][0])
  if (newest === null) return series
  const cutoff = newest - (windowDays - 1) * DAY_MS
  return series.filter(([date]) => {
    const ms = parseDay(date)
    return ms !== null && ms >= cutoff
  })
}

/**
 * Checks monthly CPI percents. Pure.
 * @param {Record<string, number|null|undefined>} values  label → monthly percent
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function checkCpi(values) {
  const errors = []
  for (const [label, value] of Object.entries(values ?? {})) {
    if (value === null || value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`CPI ${label} is not a finite number: ${JSON.stringify(value)}`)
      continue
    }
    if (value < CPI_MIN_PERCENT || value > CPI_MAX_PERCENT) {
      errors.push(`CPI ${label} of ${value}% is outside the plausible [${CPI_MIN_PERCENT}, ${CPI_MAX_PERCENT}] band`)
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true }
}

function cloneRates(rates) {
  return JSON.parse(JSON.stringify(rates))
}

function sourceOf(value, fallback) {
  if (!value || typeof value !== 'object') return { ...fallback }
  const name = typeof value.name === 'string' ? value.name : fallback.name
  const url = typeof value.url === 'string' ? value.url : fallback.url
  return { name, url }
}

/**
 * Applies validated FX and/or CPI updates to a rates file object.
 * Pure: returns a new object and never mutates `current`.
 *
 * @returns {{ ok: true, next: object, changes: string[] } | { ok: false, errors: string[] }}
 */
export function applyUpdate(current, incoming, options = {}) {
  const today = options.today ?? todayUtc()
  const errors = []
  const changes = []
  const next = cloneRates(current)

  const fx = incoming?.fx ?? null
  if (fx) {
    const merged = mergeFx(next.fx.series, fx.points ?? [], options)
    if (!merged.ok) errors.push(...merged.errors)
    else {
      const before = JSON.stringify(next.fx.series)
      next.fx.series = merged.series
      if (fx.source) {
        const source = sourceOf(fx.source, next.fx.source)
        if (source.name !== next.fx.source.name || source.url !== next.fx.source.url) {
          changes.push(`fx source → ${source.name} (${source.url})`)
          next.fx.source = source
        }
      }
      for (const [date, rate] of merged.added) changes.push(`fx ${date} = ${rate}`)
      const dropped = JSON.parse(before).length + merged.added.length - merged.series.length
      if (dropped > 0) changes.push(`fx trimmed ${dropped} point(s) outside the ${FX_WINDOW_DAYS}-day window`)
    }
  }

  const cpi = incoming?.cpi ?? null
  if (cpi) {
    const values = {}
    if (cpi.overallMonthlyPercent !== undefined && cpi.overallMonthlyPercent !== null) {
      values.overall = cpi.overallMonthlyPercent
    }
    for (const [key, value] of Object.entries(cpi.categories ?? {})) {
      // Stricter than the app's validator, which silently drops unknown keys: here an
      // unknown id means the adapter mapped a division wrong, and that should be loud.
      if (!CPI_CATEGORIES.includes(key)) errors.push(`'${key}' is not a CPI category id (${CPI_CATEGORIES.join(' ')})`)
      else values[key] = value
    }
    if (cpi.asOf !== undefined && cpi.asOf !== null && !MONTH_RE.test(cpi.asOf)) {
      errors.push(`CPI asOf must be YYYY-MM, got ${JSON.stringify(cpi.asOf)}`)
    }
    const checked = checkCpi(values)
    if (!checked.ok) errors.push(...checked.errors)

    if (errors.length === 0) {
      if (cpi.asOf !== undefined && cpi.asOf !== null && cpi.asOf !== next.cpi.asOf) {
        changes.push(`cpi asOf ${next.cpi.asOf ?? 'null'} → ${cpi.asOf}`)
        next.cpi.asOf = cpi.asOf
      }
      if (values.overall !== undefined && values.overall !== next.cpi.overallMonthlyPercent) {
        changes.push(`cpi overall ${next.cpi.overallMonthlyPercent ?? 'null'} → ${values.overall}`)
        next.cpi.overallMonthlyPercent = values.overall
      }
      for (const key of CPI_CATEGORIES) {
        if (!(key in values)) continue
        if (values[key] === next.cpi.categories[key]) continue
        changes.push(`cpi ${key} ${next.cpi.categories[key] ?? 'null'} → ${values[key]}`)
        next.cpi.categories[key] = values[key]
      }
      if (cpi.source) {
        const source = sourceOf(cpi.source, next.cpi.source)
        if (source.name !== next.cpi.source.name || source.url !== next.cpi.source.url) {
          changes.push(`cpi source → ${source.name} (${source.url})`)
          next.cpi.source = source
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  if (changes.length === 0) return { ok: true, next: current, changes: [] }

  next.updatedAt = today
  const shape = checkShape(next)
  if (!shape.ok) return { ok: false, errors: shape.errors }
  return { ok: true, next, changes }
}

/**
 * Last line of defence before anything reaches disk: a JS mirror of validateRates in
 * src/lib/rates/schema.ts. Anything this accepts, that accepts.
 */
export function checkShape(rates) {
  const errors = []
  if (rates === null || typeof rates !== 'object' || Array.isArray(rates)) {
    return { ok: false, errors: ['not an object'] }
  }
  if (rates.schema !== 1) errors.push(`schema must be exactly 1, got ${JSON.stringify(rates.schema)}`)
  if (rates.updatedAt !== null && parseDay(rates.updatedAt) === null) {
    errors.push(`updatedAt must be YYYY-MM-DD or null, got ${JSON.stringify(rates.updatedAt)}`)
  }
  const cpi = rates.cpi
  if (!cpi || typeof cpi !== 'object') errors.push('cpi is missing')
  else {
    if (typeof cpi.source?.name !== 'string' || typeof cpi.source?.url !== 'string') {
      errors.push('cpi.source is malformed')
    }
    if (cpi.asOf !== null && !MONTH_RE.test(String(cpi.asOf))) {
      errors.push(`cpi.asOf must be YYYY-MM or null, got ${JSON.stringify(cpi.asOf)}`)
    }
    const overall = cpi.overallMonthlyPercent
    if (overall !== null && !isNumber(overall)) errors.push('cpi.overallMonthlyPercent must be a finite number or null')
    if (!cpi.categories || typeof cpi.categories !== 'object') errors.push('cpi.categories is missing')
    else {
      for (const [key, value] of Object.entries(cpi.categories)) {
        if (!CPI_CATEGORIES.includes(key)) errors.push(`cpi.categories has an unknown id '${key}'`)
        else if (value !== null && !isNumber(value)) errors.push(`cpi.categories.${key} must be a finite number or null`)
      }
    }
  }
  const fx = rates.fx
  if (!fx || typeof fx !== 'object') errors.push('fx is missing')
  else {
    if (typeof fx.source?.name !== 'string' || typeof fx.source?.url !== 'string') errors.push('fx.source is malformed')
    if (typeof fx.pair !== 'string') errors.push('fx.pair must be a string')
    if (!Array.isArray(fx.series)) errors.push('fx.series must be an array')
    else {
      let previous = ''
      for (const point of fx.series) {
        if (!Array.isArray(point) || point.length !== 2) {
          errors.push(`fx.series has a malformed point ${JSON.stringify(point)}`)
          continue
        }
        const [date, rate] = point
        if (parseDay(date) === null) errors.push(`fx.series has a bad date ${JSON.stringify(date)}`)
        else if (date <= previous && previous !== '') errors.push(`fx.series is not sorted ascending at ${date}`)
        else previous = date
        if (!isPositiveNumber(rate)) errors.push(`fx.series rate for ${date} must be a finite number > 0`)
      }
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true }
}

export function readRates(path = RATES_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Pretty JSON, except that each FX point stays on one line. With 400 points the default
 * indent would be 1,600 lines and ~3x the bytes — and this file is fetched by every user
 * and committed every day, so both the diff and the wire size are worth keeping small.
 */
export function serialiseRates(rates) {
  const json = JSON.stringify(rates, null, 2)
  const collapsed = json.replace(/\[\s+("\d{4}-\d{2}-\d{2}"),\s+(-?[\d.eE+]+)\s+\]/g, '[$1, $2]')
  return `${collapsed}\n`
}

/** Writes via a temp file + rename so a crash can never leave a half-written rates.json. */
export function writeRates(rates, path = RATES_PATH) {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, serialiseRates(rates), 'utf8')
  renameSync(tmp, path)
}

export function warn(lines) {
  for (const line of lines) console.log(`::warning::${line}`)
}

/** Lets the workflow branch on what actually changed without parsing stdout. */
export function emitOutputs(outputs) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  const body = Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')
  writeFileSync(file, `${body}\n`, { flag: 'a' })
}

async function loadAdapter(name) {
  const path = resolve(HERE, 'sources', `${name}.mjs`)
  if (!existsSync(path)) throw new Error(`no adapter named '${name}' in scripts/rates/sources/`)
  return import(pathToFileURL(path).href)
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run')
  const fxOnly = argv.includes('--fx-only')
  const cpiOnly = argv.includes('--cpi-only')
  if (fxOnly && cpiOnly) {
    warn(['--fx-only and --cpi-only are mutually exclusive'])
    return 0
  }
  const configPath = readFlag(argv, '--config') ?? CONFIG_PATH
  const ratesPath = readFlag(argv, '--file') ?? RATES_PATH

  let config
  let current
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'))
    current = readRates(ratesPath)
  } catch (err) {
    warn([`cannot read the pipeline inputs: ${err.message}`])
    return 0
  }

  const incoming = {}
  if (!cpiOnly) {
    const result = await callAdapter(config.fx, 'fetchFx')
    if (result.failed) return 0
    incoming.fx = result.value
  }
  if (!fxOnly) {
    const result = await callAdapter(config.cpi, 'fetchCpi')
    if (result.failed) return 0
    incoming.cpi = result.value
  }

  const applied = applyUpdate(current, incoming, {})
  if (!applied.ok) {
    warn(['rates update rejected — public/data/rates.json left untouched:', ...applied.errors])
    emitOutputs({ changed: 'false', rejected: 'true' })
    return 0
  }
  if (applied.changes.length === 0) {
    console.log('rates unchanged — nothing to write')
    emitOutputs({ changed: 'false', rejected: 'false' })
    return 0
  }

  for (const change of applied.changes) console.log(`  • ${change}`)
  if (dryRun) {
    console.log('--dry-run: nothing written')
    emitOutputs({ changed: 'false', rejected: 'false' })
    return 0
  }
  writeRates(applied.next, ratesPath)
  console.log(`✓ wrote ${ratesPath} (updatedAt ${applied.next.updatedAt})`)
  emitOutputs({
    changed: 'true',
    rejected: 'false',
    date: applied.next.updatedAt,
    cpi_as_of: applied.next.cpi.asOf ?? '',
  })
  return 0
}

async function callAdapter(entry, method) {
  const name = entry?.adapter ?? 'manual'
  try {
    const module = await loadAdapter(name)
    if (typeof module[method] !== 'function') return { failed: false, value: null }
    return { failed: false, value: (await module[method](entry?.options ?? {})) ?? null }
  } catch (err) {
    // An upstream that is down, rate-limited or geo-blocked is a normal Tuesday, not a red build.
    warn([`adapter '${name}'.${method} failed: ${err.message}`])
    return { failed: true, value: null }
  }
}

export function readFlag(argv, flag) {
  const index = argv.indexOf(flag)
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`)
  return value
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
