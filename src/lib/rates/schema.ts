import { CATEGORY_IDS, type CategoryId } from './categories'

/** The public rates file. Everything is nullable: the app degrades rather than guesses. */
export interface RatesSource {
  name: string
  url: string
}

export interface RatesCpi {
  source: RatesSource
  /**
   * The month the figures describe, 'YYYY-MM'. Iran's statistics are published by Jalali month,
   * so this is usually Jalali ('1405-05' = Mordad 1405). It is metadata, shown and never parsed
   * as a date — do not feed it to Date.parse, which would read 1405 as a Gregorian year.
   */
  asOf: string | null
  /** How much to trust these figures: 'primary' straight from the source, 'secondary' relayed. */
  confidence: 'primary' | 'secondary' | null
  overallMonthlyPercent: number | null
  /** 'other' is never keyed here — it uses the overall figure. */
  categories: Partial<Record<Exclude<CategoryId, 'other'>, number | null>>
}

/** One daily close: [YYYY-MM-DD, rate]. */
export type FxPoint = [string, number]

export interface RatesFx {
  source: RatesSource
  pair: string
  series: FxPoint[]
}

export interface RatesFile {
  schema: 1
  updatedAt: string | null
  cpi: RatesCpi
  fx: RatesFx
}

export const RATES_SCHEMA_VERSION = 1

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A number, or null. Anything else — including NaN — is rejected. */
function optionalNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function optionalString(value: unknown, pattern?: RegExp): value is string | null {
  if (value === null) return true
  return typeof value === 'string' && (!pattern || pattern.test(value))
}

function parseSource(value: unknown): RatesSource | null {
  if (!isObject(value)) return null
  if (typeof value.name !== 'string' || typeof value.url !== 'string') return null
  /* This URL comes out of a fetched file and is destined for an href. Everything else in this
   * guard is paranoid; a `javascript:` value slipping through would be the odd one out. */
  if (value.url !== '' && !/^https?:\/\//i.test(value.url)) return null
  return { name: value.name, url: value.url }
}

export type RatesProblem = 'notObject' | 'unsupportedSchema' | 'badCpi' | 'badFx'

export type RatesCheck = { ok: true; data: RatesFile } | { ok: false; problem: RatesProblem }

/**
 * Hand-written guard over the fetched file. Total: it never throws, for any input.
 * A malformed file must leave the last good cached value in place, so every failure
 * is reported rather than partially applied.
 */
export function validateRates(raw: unknown): RatesCheck {
  if (!isObject(raw)) return { ok: false, problem: 'notObject' }
  if (raw.schema !== RATES_SCHEMA_VERSION) return { ok: false, problem: 'unsupportedSchema' }
  if (!optionalString(raw.updatedAt, DATE_RE)) return { ok: false, problem: 'notObject' }

  const cpiRaw = raw.cpi
  if (!isObject(cpiRaw)) return { ok: false, problem: 'badCpi' }
  const cpiSource = parseSource(cpiRaw.source)
  if (!cpiSource) return { ok: false, problem: 'badCpi' }
  if (!optionalString(cpiRaw.asOf, MONTH_RE)) return { ok: false, problem: 'badCpi' }
  /* Absent is fine and means "unstated"; a value that is neither label is a malformed file
   * rather than something to quietly coerce. */
  const confidenceRaw = cpiRaw.confidence
  if (confidenceRaw !== undefined && confidenceRaw !== null && confidenceRaw !== 'primary' && confidenceRaw !== 'secondary') {
    return { ok: false, problem: 'badCpi' }
  }
  const confidence: RatesCpi['confidence'] = confidenceRaw === 'primary' || confidenceRaw === 'secondary' ? confidenceRaw : null
  if (!optionalNumber(cpiRaw.overallMonthlyPercent)) return { ok: false, problem: 'badCpi' }
  if (!isObject(cpiRaw.categories)) return { ok: false, problem: 'badCpi' }

  const categories: RatesCpi['categories'] = {}
  for (const [key, value] of Object.entries(cpiRaw.categories)) {
    if (key === 'other' || !(CATEGORY_IDS as readonly string[]).includes(key)) continue
    if (!optionalNumber(value)) return { ok: false, problem: 'badCpi' }
    categories[key as Exclude<CategoryId, 'other'>] = value
  }

  const fxRaw = raw.fx
  if (!isObject(fxRaw)) return { ok: false, problem: 'badFx' }
  const fxSource = parseSource(fxRaw.source)
  if (!fxSource) return { ok: false, problem: 'badFx' }
  if (typeof fxRaw.pair !== 'string') return { ok: false, problem: 'badFx' }
  if (!Array.isArray(fxRaw.series)) return { ok: false, problem: 'badFx' }

  const series: FxPoint[] = []
  for (const point of fxRaw.series) {
    if (!Array.isArray(point) || point.length !== 2) return { ok: false, problem: 'badFx' }
    const [date, rate] = point
    if (typeof date !== 'string' || !DATE_RE.test(date)) return { ok: false, problem: 'badFx' }
    // A zero or negative rate would make the FX ratio meaningless, so it is not "just data".
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return { ok: false, problem: 'badFx' }
    series.push([date, rate])
  }
  // Sorted ascending so every reader can assume the last point is the newest.
  series.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  return {
    ok: true,
    data: {
      schema: RATES_SCHEMA_VERSION,
      updatedAt: raw.updatedAt,
      cpi: {
        source: cpiSource,
        asOf: cpiRaw.asOf,
        confidence,
        overallMonthlyPercent: cpiRaw.overallMonthlyPercent,
        categories,
      },
      fx: { source: fxSource, pair: fxRaw.pair, series },
    },
  }
}

/** The monthly percent for a category, falling back to the overall index. */
export function categoryMonthlyPercent(rates: RatesFile, category: CategoryId): number | null {
  if (category === 'other') return rates.cpi.overallMonthlyPercent
  return rates.cpi.categories[category] ?? rates.cpi.overallMonthlyPercent
}
