import { describe, expect, it } from 'vitest'
import {
  MS_PER_MONTH,
  OUTLIER_DOWN,
  OUTLIER_UP,
  checkOutlier,
  estimatePersonal,
  usableObservations,
  type RateObservation,
} from './estimate'

const T0 = Date.UTC(2026, 0, 1)
const DAY = 86_400_000

const at = (months: number, cost: number, extra: Partial<RateObservation> = {}): RateObservation => ({
  cost,
  observedAt: T0 + months * MS_PER_MONTH,
  ...extra,
})

const monthlyPercent = (g: number): number => Math.expm1(g) * 100

describe('MS_PER_MONTH', () => {
  it('is one mean Gregorian month in milliseconds', () => {
    expect(MS_PER_MONTH).toBe(30.436875 * 86_400_000)
    expect(MS_PER_MONTH).toBe(2_629_746_000)
  })
})

describe('estimatePersonal', () => {
  it('vector 1 — 100000 then 115000 three months later fits 4.769%/month', () => {
    const now = T0 + 3 * MS_PER_MONTH
    const fit = estimatePersonal([at(0, 100_000), at(3, 115_000)], now)
    expect(fit).not.toBeNull()
    if (!fit) return
    expect(monthlyPercent(fit.g)).toBeCloseTo(4.769, 3)
    expect(fit.n).toBe(2)
    expect(fit.spanMonths).toBeCloseTo(3, 10)
  })

  it('reads a flat run of prices as ~0 growth rather than as no answer', () => {
    const now = T0 + 5 * MS_PER_MONTH
    const fit = estimatePersonal([at(0, 50_000), at(1, 50_000), at(2, 50_000), at(3, 50_000), at(4, 50_000)], now)
    expect(fit).not.toBeNull()
    if (!fit) return
    expect(fit.g).toBeCloseTo(0, 12)
    expect(fit.n).toBe(5)
  })

  it('leans on recent readings: nudging the newest price moves the slope more than nudging the oldest', () => {
    const now = T0 + 3 * MS_PER_MONTH
    const base = [at(0, 100_000), at(1, 103_000), at(2, 106_090), at(3, 109_272.7)]
    const gOf = (observations: RateObservation[]): number => estimatePersonal(observations, now)?.g ?? Number.NaN
    const oldestUp = gOf([at(0, 110_000), at(1, 103_000), at(2, 106_090), at(3, 109_272.7)])
    const newestUp = gOf([at(0, 100_000), at(1, 103_000), at(2, 106_090), at(3, 120_199.97)])
    const g0 = gOf(base)
    expect(Math.abs(newestUp - g0)).toBeGreaterThan(Math.abs(oldestUp - g0))
  })

  it.each([
    ['zero observations', [] as RateObservation[]],
    ['one observation', [at(0, 100_000)]],
    ['two observations 10 days apart', [{ cost: 100_000, observedAt: T0 }, { cost: 120_000, observedAt: T0 + 10 * DAY }]],
    ['two observations where one is excluded', [at(0, 100_000), at(3, 115_000, { excluded: true })]],
  ])('returns null for %s', (_label, observations) => {
    expect(estimatePersonal(observations, T0 + 6 * MS_PER_MONTH)).toBeNull()
  })

  it('returns null at exactly the 14-day floor minus a millisecond, and a fit just over it', () => {
    const now = T0 + 30 * DAY
    const under = [{ cost: 100_000, observedAt: T0 }, { cost: 110_000, observedAt: T0 + 14 * DAY - 1 }]
    const over = [{ cost: 100_000, observedAt: T0 }, { cost: 110_000, observedAt: T0 + 14 * DAY }]
    expect(estimatePersonal(under, now)).toBeNull()
    expect(estimatePersonal(over, now)).not.toBeNull()
  })

  it('survives adversarial input without producing NaN or Infinity', () => {
    const now = T0 + 6 * MS_PER_MONTH
    const cases: RateObservation[][] = [
      [{ cost: 0, observedAt: T0 }, at(3, 100_000)],
      [{ cost: -5_000, observedAt: T0 }, at(3, 100_000)],
      [{ cost: 100_000, observedAt: T0 }, { cost: 120_000, observedAt: T0 }],
      [at(0, 1e-9), at(3, 1e12)],
      [{ cost: Number.NaN, observedAt: T0 }, { cost: 100_000, observedAt: Number.NaN }],
      [at(0, 100_000), at(3, 100_000), { cost: Infinity, observedAt: T0 + MS_PER_MONTH }],
    ]
    for (const observations of cases) {
      const fit = estimatePersonal(observations, now)
      if (fit === null) continue
      expect(Number.isFinite(fit.g)).toBe(true)
      expect(Number.isFinite(fit.spanMonths)).toBe(true)
      expect(Number.isFinite(fit.n)).toBe(true)
    }
  })

  it('drops a zero-cost reading instead of taking its logarithm', () => {
    const now = T0 + 3 * MS_PER_MONTH
    const clean = estimatePersonal([at(0, 100_000), at(3, 115_000)], now)
    const dirty = estimatePersonal([{ cost: 0, observedAt: T0 + 1.5 * MS_PER_MONTH }, at(0, 100_000), at(3, 115_000)], now)
    expect(dirty).toEqual(clean)
  })

  it('two readings at the identical timestamp have no slope to find', () => {
    expect(estimatePersonal([{ cost: 100_000, observedAt: T0 }, { cost: 300_000, observedAt: T0 }], T0)).toBeNull()
  })
})

describe('usableObservations', () => {
  it('keeps only priced, non-excluded readings and sorts them oldest first', () => {
    const points = usableObservations([at(3, 115_000), at(0, 100_000), at(1, 0), at(2, 110_000, { excluded: true })])
    expect(points.map((p) => p.cost)).toEqual([100_000, 115_000])
  })
})

describe('checkOutlier', () => {
  const history = [at(0, 100_000), at(1, 103_000), at(2, 106_090), at(3, 109_272.7)]

  it('accepts a reading that continues the trend', () => {
    const verdict = checkOutlier(history, at(4, 112_550))
    expect(verdict.outlier).toBe(false)
  })

  it('flags a reading far above the fitted line and says what rate it would imply', () => {
    const verdict = checkOutlier(history, at(4, 250_000))
    expect(verdict.outlier).toBe(true)
    if (!verdict.outlier) return
    expect(verdict.expectedCost).toBeGreaterThan(110_000)
    expect(verdict.expectedCost).toBeLessThan(115_000)
    // 109272.7 → 250000 in one month.
    expect(verdict.impliedMonthlyPercent).toBeCloseTo(128.8, 0)
  })

  it('flags a collapse below the floor', () => {
    const verdict = checkOutlier(history, at(4, 50_000))
    expect(verdict.outlier).toBe(true)
    if (!verdict.outlier) return
    expect(verdict.impliedMonthlyPercent).toBeLessThan(0)
  })

  it('judges against the newest reading when no line can be fitted', () => {
    const single = [{ cost: 100_000, observedAt: T0 }]
    const ok = checkOutlier(single, { cost: 130_000, observedAt: T0 + 30 * DAY })
    const bad = checkOutlier(single, { cost: 200_000, observedAt: T0 + 30 * DAY })
    expect(ok.outlier).toBe(false)
    expect(bad.outlier).toBe(true)
    if (!bad.outlier) return
    expect(bad.expectedCost).toBe(100_000)
  })

  it('sits exactly on the published thresholds', () => {
    const single = [{ cost: 100_000, observedAt: T0 }]
    const later = T0 + 30 * DAY
    expect(checkOutlier(single, { cost: 100_000 * (1 + OUTLIER_UP), observedAt: later }).outlier).toBe(false)
    expect(checkOutlier(single, { cost: 100_000 * (1 + OUTLIER_UP) + 1, observedAt: later }).outlier).toBe(true)
    expect(checkOutlier(single, { cost: 100_000 * (1 + OUTLIER_DOWN), observedAt: later }).outlier).toBe(false)
    expect(checkOutlier(single, { cost: 100_000 * (1 + OUTLIER_DOWN) - 1, observedAt: later }).outlier).toBe(true)
  })

  it('has nothing to judge against with an empty or fully excluded history', () => {
    expect(checkOutlier([], at(0, 100_000)).outlier).toBe(false)
    expect(checkOutlier([at(0, 100_000, { excluded: true })], at(1, 900_000)).outlier).toBe(false)
  })

  it('never returns a non-finite implied rate, even for a re-reading at the same instant', () => {
    const verdict = checkOutlier([{ cost: 100_000, observedAt: T0 }], { cost: 900_000, observedAt: T0 })
    expect(verdict.outlier).toBe(true)
    if (!verdict.outlier) return
    expect(Number.isFinite(verdict.impliedMonthlyPercent)).toBe(true)
    expect(verdict.impliedMonthlyPercent).toBeCloseTo(800, 6)
  })

  it('ignores a garbage candidate rather than flagging it', () => {
    expect(checkOutlier(history, at(4, 0)).outlier).toBe(false)
    expect(checkOutlier(history, at(4, -1)).outlier).toBe(false)
    expect(checkOutlier(history, { cost: 200_000, observedAt: Number.NaN }).outlier).toBe(false)
  })
})
