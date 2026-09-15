/** Per-product price history → a monthly log growth rate, fitted in log space and weighted toward recent readings. */

/**
 * One mean month, 30.436875 days — the average Gregorian month length. Calendar months
 * would make `g` depend on which months a product happened to be bought in, so the whole
 * model measures elapsed time in these instead.
 */
export const MS_PER_MONTH = 30.436875 * 86_400_000

/** Structural on purpose, so the engine never imports the Dexie row type. */
export interface RateObservation {
  cost: number
  observedAt: number
  fxAtDate?: number
  excluded?: boolean
}

export interface PersonalFit {
  g: number
  n: number
  spanMonths: number
}

/** Older readings fade with a 6-month half-life-ish decay, so last year's price cannot outvote last week's. */
const WEIGHT_HALFLIFE_MONTHS = 6

/** Two points a few days apart measure noise, not a trend; 14 days is the shortest span worth a slope. */
const MIN_SPAN_MS = 14 * 86_400_000

/** A reading the fit can actually use: ln(cost) has to exist, so a zero or negative cost is dropped, not clamped. */
function usable(o: RateObservation): boolean {
  return o.excluded !== true && Number.isFinite(o.cost) && o.cost > 0 && Number.isFinite(o.observedAt)
}

/** Non-excluded, positively-priced readings, oldest first. */
export function usableObservations(observations: readonly RateObservation[]): RateObservation[] {
  return observations.filter(usable).sort((a, b) => a.observedAt - b.observedAt)
}

interface LogLine {
  /** Slope: monthly log growth. */
  b: number
  /** Intercept at t = 0, where t is months relative to `origin`. */
  a: number
  origin: number
  n: number
  spanMonths: number
}

/**
 * Weighted least squares of ln(cost) on time in months, in centred form so a far-away
 * origin cannot swamp the sums. Returns null when the points carry no usable trend.
 */
function fitLogLine(observations: readonly RateObservation[], now: number): LogLine | null {
  const points = usableObservations(observations)
  const n = points.length
  const first = points[0]
  const last = points[n - 1]
  if (n < 2 || !first || !last) return null

  const spanMs = last.observedAt - first.observedAt
  if (spanMs < MIN_SPAN_MS) return null

  let sw = 0
  let swt = 0
  let swy = 0
  for (const p of points) {
    // A reading dated after `now` is clock skew, not foresight, so it gets full weight rather than extra.
    const age = Math.max(0, (now - p.observedAt) / MS_PER_MONTH)
    const w = Math.exp(-age / WEIGHT_HALFLIFE_MONTHS)
    if (!Number.isFinite(w) || w <= 0) continue
    const t = (p.observedAt - now) / MS_PER_MONTH
    const y = Math.log(p.cost)
    sw += w
    swt += w * t
    swy += w * y
  }
  if (!(sw > 0) || !Number.isFinite(sw)) return null

  const tBar = swt / sw
  const yBar = swy / sw
  let sxx = 0
  let sxy = 0
  for (const p of points) {
    const age = Math.max(0, (now - p.observedAt) / MS_PER_MONTH)
    const w = Math.exp(-age / WEIGHT_HALFLIFE_MONTHS)
    if (!Number.isFinite(w) || w <= 0) continue
    const t = (p.observedAt - now) / MS_PER_MONTH - tBar
    sxx += w * t * t
    sxy += w * t * (Math.log(p.cost) - yBar)
  }
  // Every reading at the same instant leaves no spread in t; a slope through them would be a division by zero.
  if (!(sxx > 0) || !Number.isFinite(sxx)) return null

  const b = sxy / sxx
  const a = yBar - b * tBar
  if (!Number.isFinite(b) || !Number.isFinite(a)) return null
  return { b, a, origin: now, n, spanMonths: spanMs / MS_PER_MONTH }
}

/** The product's own price trend: monthly log growth, or null when the history cannot support one. */
export function estimatePersonal(observations: RateObservation[], now: number): PersonalFit | null {
  const line = fitLogLine(observations, now)
  if (!line) return null
  return { g: line.b, n: line.n, spanMonths: line.spanMonths }
}

export type OutlierVerdict = { outlier: false } | { outlier: true; impliedMonthlyPercent: number; expectedCost: number }

/** A reading more than 40% above expectation is almost always a typo or a different pack size. */
export const OUTLIER_UP = 0.4

/** Prices fall too, but a 20% drop is worth a second look before it drags the whole fit down. */
export const OUTLIER_DOWN = -0.2

/**
 * Judge a new reading against the fitted line when one exists, else against the newest observation.
 * The candidate's own timestamp is the clock: this never asks the environment what time it is.
 */
export function checkOutlier(history: RateObservation[], candidate: RateObservation): OutlierVerdict {
  if (!Number.isFinite(candidate.cost) || candidate.cost <= 0 || !Number.isFinite(candidate.observedAt)) {
    return { outlier: false }
  }
  const points = usableObservations(history)
  const previous = points[points.length - 1]
  if (!previous) return { outlier: false }

  const line = fitLogLine(history, candidate.observedAt)
  const expectedCost = line
    ? Math.exp(line.a + line.b * ((candidate.observedAt - line.origin) / MS_PER_MONTH))
    : previous.cost
  if (!Number.isFinite(expectedCost) || expectedCost <= 0) return { outlier: false }

  const deviation = candidate.cost / expectedCost - 1
  if (deviation <= OUTLIER_UP && deviation >= OUTLIER_DOWN) return { outlier: false }

  // What monthly rate the shopkeeper would be accepting if this reading were true, measured from the
  // previous one. A re-reading at the same instant has no time base, so it degrades to the raw jump.
  const gapMonths = (candidate.observedAt - previous.observedAt) / MS_PER_MONTH
  const ratio = candidate.cost / previous.cost
  const impliedMonthlyPercent =
    gapMonths > 0 ? Math.expm1(Math.log(ratio) / gapMonths) * 100 : (ratio - 1) * 100

  return {
    outlier: true,
    impliedMonthlyPercent: Number.isFinite(impliedMonthlyPercent) ? impliedMonthlyPercent : 0,
    expectedCost,
  }
}
