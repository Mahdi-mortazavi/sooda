import { describe, expect, it } from 'vitest'
import { MS_PER_MONTH, forecastCost, productRate, type ProductRateInput, type RateObservation } from './index'
import type { FxPoint, RatesFile } from './schema'

const NOW = Date.parse('2026-09-15T00:00:00Z')
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString().slice(0, 10)

/** A 90-day series climbing `daily` per day, ending today. */
function series(days: number, start: number, daily: number): FxPoint[] {
  const points: FxPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    points.push([iso(i * 86_400_000), start * Math.pow(1 + daily, days - 1 - i)])
  }
  return points
}

const ratesFile = (over: Partial<RatesFile> = {}): RatesFile => ({
  schema: 1,
  updatedAt: iso(5 * 86_400_000),
  cpi: {
    source: { name: 'Statistical Center of Iran', url: 'https://www.amar.org.ir/' },
    asOf: '2026-08',
    overallMonthlyPercent: 2.5,
    categories: { food: 3, apparel: 2.9 },
  },
  fx: { source: { name: 'Example', url: 'https://example.com' }, pair: 'USD/IRT', series: series(90, 100_000, 0.001) },
  ...over,
})

const at = (monthsAgo: number, cost: number, extra: Partial<RateObservation> = {}): RateObservation => ({
  cost,
  observedAt: NOW - monthsAgo * MS_PER_MONTH,
  ...extra,
})

const request = (over: Partial<ProductRateInput> = {}): ProductRateInput => ({
  observations: [at(3, 100_000), at(0, 115_000)],
  category: 'food',
  importDependency: 0,
  rates: ratesFile(),
  now: NOW,
  ...over,
})

describe('productRate', () => {
  it('reproduces vector 2 end to end — λ=0.5 and 3.881%/month on a 3% category', () => {
    const rate = productRate(
      request({ rates: ratesFile({ cpi: { ...ratesFile().cpi, categories: { food: 3 } } }), importDependency: 0 }),
    )
    expect(rate.lambda).toBeCloseTo(0.5, 12)
    expect(rate.monthlyPercent).toBeCloseTo(3.881, 3)
    expect(rate.used.personal).toBe(true)
    expect(rate.used.category).toBe(true)
  })

  it('grows the newest cost forward and reports its age', () => {
    const rate = productRate(request({ observations: [at(3, 100_000), at(1, 115_000)] }))
    expect(rate.lastObservedAt).toBe(NOW - MS_PER_MONTH)
    expect(rate.ageMonths).toBeCloseTo(1, 12)
    expect(rate.replacementNow).not.toBeNull()
    if (rate.replacementNow === null) return
    expect(rate.g).not.toBeNull()
    expect(rate.replacementNow).toBeCloseTo(115_000 * Math.exp(rate.g ?? 0), 6)
  })

  it('takes the FX path when the last reading stored a rate and the product is imported', () => {
    const observations = [at(3, 100_000), at(1, 115_000, { fxAtDate: 100_000 })]
    const rate = productRate(request({ observations, importDependency: 1 }))
    const fxNow = 100_000 * Math.pow(1.001, 89)
    expect(rate.replacementNow).not.toBeNull()
    if (rate.replacementNow === null) return
    expect(rate.replacementNow).toBeCloseTo(115_000 * (fxNow / 100_000), 4)
  })

  it('has nothing to grow forward without a usable observation', () => {
    for (const observations of [[], [at(1, 100_000, { excluded: true })], [at(1, 0)]]) {
      const rate = productRate(request({ observations }))
      expect(rate.replacementNow).toBeNull()
      expect(rate.lastObservedAt).toBeNull()
      expect(rate.ageMonths).toBe(0)
      expect(Number.isFinite(rate.g)).toBe(true)
      expect(forecastCost(rate, 6)).toBeNull()
    }
  })

  it('rests on the personal fit alone with no rates file at all', () => {
    // Regression: the absent prior used to be blended in as a zero and pull the answer down.
    const rate = productRate(request({ rates: null }))
    expect(rate.gPrior).toBeNull()
    expect(rate.g).not.toBeNull()
    expect(rate.g).toBeCloseTo(rate.gPersonal ?? Number.NaN, 12)
    expect(rate.used.category).toBe(false)
    expect(rate.used.fx).toBe(false)
    expect(rate.confidence).toBe('low')
  })

  it('is finite when every figure in the file is null', () => {
    const bare = ratesFile({
      updatedAt: null,
      cpi: { ...ratesFile().cpi, overallMonthlyPercent: null, categories: {} },
      fx: { ...ratesFile().fx, series: [] },
    })
    const rate = productRate(request({ rates: bare }))
    expect(rate.gPrior).toBeNull()
    expect(rate.g).toBeCloseTo(rate.gPersonal ?? Number.NaN, 12)
    expect(rate.used).toEqual({ personal: true, category: false, fx: false })
  })

  it('never lets an excluded reading change any part of the answer', () => {
    const clean = productRate(request())
    const noisy = productRate(
      request({
        observations: [
          at(3, 100_000),
          at(2, 9_999_999, { excluded: true, fxAtDate: 1 }),
          at(0, 115_000),
          at(0.001, 1, { excluded: true }),
        ],
      }),
    )
    expect(noisy).toEqual(clean)
  })

  it('is deterministic for a fixed now', () => {
    const input = request({ importDependency: 0.5 })
    expect(productRate(input)).toEqual(productRate(input))
  })

  it('caps a runaway history at +25%/month and flags it', () => {
    const rate = productRate(
      request({ observations: [at(6, 10_000), at(4, 60_000), at(2, 300_000), at(0, 2_000_000)] }),
    )
    expect(rate.clamped).toBe('high')
    expect(rate.monthlyPercent).toBeCloseTo(25, 10)
  })

  it('floors a collapsing history at −5%/month and flags it', () => {
    const rate = productRate(
      request({
        observations: [at(6, 2_000_000), at(4, 900_000), at(2, 400_000), at(0, 150_000)],
        rates: ratesFile({ cpi: { ...ratesFile().cpi, overallMonthlyPercent: -6, categories: { food: -6 } } }),
      }),
    )
    expect(rate.clamped).toBe('low')
    expect(rate.monthlyPercent).toBeCloseTo(-5, 10)
  })

  it('lets a manual rate win while still reporting the signals behind it', () => {
    const rate = productRate(request({ manualMonthlyPercent: 6 }))
    expect(rate.manual).toBe(true)
    expect(rate.monthlyPercent).toBeCloseTo(6, 10)
    expect(rate.clamped).toBeNull()
    /* Regression: the manual path used to return the auto-computed gDomestic, unclamped —
     * so an override of 6%/month could quote a restock cost built from 54%/month. */
    expect(rate.gDomestic).toBeCloseTo(Math.log1p(0.06), 12)
    expect(rate.lambda).toBeCloseTo(0.5, 12)
    expect(rate.gPersonal).not.toBeNull()
  })

  it('treats a manual 0 as flat prices, not as no override', () => {
    const rate = productRate(request({ manualMonthlyPercent: 0 }))
    expect(rate.manual).toBe(true)
    expect(rate.g).toBe(0)
    expect(rate.replacementNow).toBeCloseTo(115_000, 6)
  })

  it('reports confidence from lambda and the file’s age together', () => {
    const rich = [at(9, 60_000), at(6, 70_000), at(4, 80_000), at(2, 90_000), at(0, 100_000)]
    expect(productRate(request({ observations: rich })).confidence).toBe('high')
    expect(productRate(request({ observations: [] })).confidence).toBe('low')
    expect(productRate(request({ observations: rich, rates: ratesFile({ updatedAt: '2025-01-01' }) })).confidence).toBe(
      'low',
    )
  })

  it('survives adversarial observations without NaN or Infinity anywhere', () => {
    const cases: RateObservation[][] = [
      [at(3, 0), at(0, -1)],
      [{ cost: 100_000, observedAt: NOW }, { cost: 120_000, observedAt: NOW }],
      [at(3, 1e-9), at(0, 1e12)],
      [{ cost: Number.NaN, observedAt: Number.NaN }],
    ]
    for (const observations of cases) {
      const rate = productRate(request({ observations, importDependency: 0.5 }))
      expect(Number.isFinite(rate.g)).toBe(true)
      expect(Number.isFinite(rate.monthlyPercent)).toBe(true)
      expect(Number.isFinite(rate.lambda)).toBe(true)
      expect(Number.isFinite(rate.gPrior)).toBe(true)
      expect(Number.isFinite(rate.gDomestic)).toBe(true)
      expect(Number.isFinite(rate.ageMonths)).toBe(true)
      if (rate.replacementNow !== null) expect(Number.isFinite(rate.replacementNow)).toBe(true)
    }
  })
})

describe('forecastCost', () => {
  it('compounds the replacement cost at the blended rate', () => {
    const rate = productRate(request())
    expect(rate.replacementNow).not.toBeNull()
    if (rate.replacementNow === null) return
    expect(rate.g).not.toBeNull()
    expect(forecastCost(rate, 3)).toBeCloseTo(rate.replacementNow * Math.exp((rate.g ?? 0) * 3), 6)
  })

  it('is the replacement cost itself at zero months', () => {
    const rate = productRate(request())
    expect(forecastCost(rate, 0)).toBe(rate.replacementNow)
  })
})
