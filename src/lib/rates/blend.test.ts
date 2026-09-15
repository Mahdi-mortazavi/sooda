import { describe, expect, it } from 'vitest'
import { MONTHLY_MAX, MONTHLY_MIN, blend, forecast, replacementNow, type BlendInput } from './blend'
import { MS_PER_MONTH, type PersonalFit } from './estimate'

/** The briefed vectors carry 0.01% tolerance; asserting on the ratio keeps that honest at any magnitude. */
const expectRelative = (actual: number, expected: number, tolerance = 1e-4): void => {
  expect(Math.abs(actual / expected - 1)).toBeLessThan(tolerance)
}

/** The fit from vector 1: 100000 → 115000 over three months. */
const VECTOR_FIT: PersonalFit = { g: Math.log(1.15) / 3, n: 2, spanMonths: 3 }

const input = (over: Partial<BlendInput> = {}): BlendInput => ({
  personal: null,
  categoryMonthlyPercent: null,
  overallMonthlyPercent: null,
  fxTrendMonthlyLog: null,
  importDependency: 0,
  ...over,
})

describe('blend — briefed vectors', () => {
  it('vector 2 — n=2, span=3, category 3%, s=0 → λ=0.5 and 3.881%/month', () => {
    const result = blend(input({ personal: VECTOR_FIT, categoryMonthlyPercent: 3, importDependency: 0 }))
    expect(result.lambda).toBeCloseTo(0.5, 12)
    expect(result.monthlyPercent).toBeCloseTo(3.881, 3)
    expect(result.clamped).toBe(false)
    expect(result.manual).toBe(false)
    expect(result.used).toEqual({ personal: true, category: true, fx: false })
  })

  it('vector 3 — the same fit stretched to n=5, span=6 → λ=5/7 and 4.260%/month', () => {
    const result = blend(
      input({ personal: { ...VECTOR_FIT, n: 5, spanMonths: 6 }, categoryMonthlyPercent: 3, importDependency: 0 }),
    )
    expect(result.lambda).toBeCloseTo(5 / 7, 12)
    expect(result.monthlyPercent).toBeCloseTo(4.26, 3)
  })

  it('vector 6 — the vector-4 replacement grown three months at the vector-2 rate is 1,264,831.30', () => {
    const rNow = replacementNow({
      lastCost: 1_000_000,
      lastObservedAt: 0,
      now: 2 * MS_PER_MONTH,
      lastFx: 100_000,
      fxNow: 120_000,
      importDependency: 0.5,
      gDomestic: Math.log1p(0.03),
      gProduct: 0,
    })
    const g = blend(input({ personal: VECTOR_FIT, categoryMonthlyPercent: 3, importDependency: 0 })).g
    expectRelative(forecast(rNow, g, 3), 1_264_831.3)
  })

  it('only reproduces vector 6 from an unrounded g — the rounded 3.881% lands ten thousand rial away', () => {
    const rNow = 1_128_308.4685
    expectRelative(forecast(rNow, Math.log1p(3.881 / 100), 3), 1_264_841.81)
  })
})

describe('blend — lambda', () => {
  it('is 0 when there is no personal fit', () => {
    expect(blend(input({ categoryMonthlyPercent: 3 })).lambda).toBe(0)
  })

  it('stays inside [0, 1] for any n ≥ 0 and any span ≥ 0', () => {
    const ns = [0, 0.5, 1, 2, 3, 5, 10, 1e6, 1e300, Number.POSITIVE_INFINITY]
    const spans = [0, 0.001, 1, 3, 6, 120, 1e300, Number.POSITIVE_INFINITY]
    for (const n of ns) {
      for (const spanMonths of spans) {
        const { lambda } = blend(input({ personal: { g: 0.01, n, spanMonths }, categoryMonthlyPercent: 3 }))
        expect(Number.isFinite(lambda)).toBe(true)
        expect(lambda).toBeGreaterThanOrEqual(0)
        expect(lambda).toBeLessThanOrEqual(1)
      }
    }
  })

  it('grows with both the count and the span, never past 1', () => {
    const at = (n: number, spanMonths: number): number =>
      blend(input({ personal: { g: 0.01, n, spanMonths }, categoryMonthlyPercent: 3 })).lambda
    expect(at(2, 1)).toBeLessThan(at(2, 3))
    expect(at(2, 3)).toBeLessThan(at(9, 3))
    expect(at(9, 3)).toBeLessThan(1)
    expect(at(2, 3)).toBe(at(2, 30))
  })
})

describe('blend — the prior', () => {
  it('splits the FX leg evenly between the dollar trend and the overall index', () => {
    const gTrend = 0.04
    const overall = 2
    const result = blend(input({ fxTrendMonthlyLog: gTrend, overallMonthlyPercent: overall, importDependency: 1 }))
    expect(result.gPrior).toBeCloseTo(0.5 * gTrend + 0.5 * Math.log1p(overall / 100), 12)
    expect(result.used).toEqual({ personal: false, category: false, fx: true })
  })

  it('lets one half of the FX leg speak alone when the other is missing', () => {
    const onlyTrend = blend(input({ fxTrendMonthlyLog: 0.04, importDependency: 1 }))
    const onlyCpi = blend(input({ overallMonthlyPercent: 2, importDependency: 1 }))
    expect(onlyTrend.gPrior).toBeCloseTo(0.04, 12)
    expect(onlyCpi.gPrior).toBeCloseTo(Math.log1p(0.02), 12)
  })

  it('mixes category and FX by import dependency', () => {
    const shared = { categoryMonthlyPercent: 3, overallMonthlyPercent: 2, fxTrendMonthlyLog: 0.04 }
    const gCat = Math.log1p(0.03)
    const gFx = 0.5 * 0.04 + 0.5 * Math.log1p(0.02)
    expect(blend(input({ ...shared, importDependency: 0 })).gPrior).toBeCloseTo(gCat, 12)
    expect(blend(input({ ...shared, importDependency: 0.5 })).gPrior).toBeCloseTo(0.5 * gCat + 0.5 * gFx, 12)
    expect(blend(input({ ...shared, importDependency: 1 })).gPrior).toBeCloseTo(gFx, 12)
  })

  it('falls back to a prior of 0 when every figure is null, and still returns a finite number', () => {
    const result = blend(input())
    expect(result.gPrior).toBe(0)
    expect(result.g).toBe(0)
    expect(result.monthlyPercent).toBe(0)
    expect(result.used).toEqual({ personal: false, category: false, fx: false })
    expect(Number.isFinite(result.g)).toBe(true)
  })

  it('does not credit a signal that its weight multiplies away', () => {
    expect(blend(input({ categoryMonthlyPercent: 3, importDependency: 1 })).used.category).toBe(false)
    expect(blend(input({ fxTrendMonthlyLog: 0.04, importDependency: 0 })).used.fx).toBe(false)
  })

  it('rejects a category figure at or below −100%, which has no logarithm', () => {
    const result = blend(input({ categoryMonthlyPercent: -100 }))
    expect(result.gPrior).toBe(0)
    expect(result.used.category).toBe(false)
  })
})

describe('blend — gDomestic', () => {
  it('is the category rate alone when there is no personal fit', () => {
    expect(blend(input({ categoryMonthlyPercent: 3 })).gDomestic).toBeCloseTo(Math.log1p(0.03), 12)
  })

  it('ignores the dollar entirely, whatever the import dependency', () => {
    const shared = { personal: VECTOR_FIT, categoryMonthlyPercent: 3, fxTrendMonthlyLog: 0.2 }
    const a = blend(input({ ...shared, importDependency: 0 })).gDomestic
    const b = blend(input({ ...shared, importDependency: 1 })).gDomestic
    expect(a).toBe(b)
    expect(a).toBeCloseTo(0.5 * VECTOR_FIT.g + 0.5 * Math.log1p(0.03), 12)
  })
})

describe('blend — clamping', () => {
  it('caps a runaway fit at +25%/month and says so', () => {
    const result = blend(input({ personal: { g: Math.log(3), n: 50, spanMonths: 24 }, categoryMonthlyPercent: 3 }))
    expect(result.clamped).toBe(true)
    expect(result.monthlyPercent).toBeCloseTo(MONTHLY_MAX * 100, 10)
    expect(result.g).toBeCloseTo(Math.log1p(MONTHLY_MAX), 12)
  })

  it('floors a collapse at −5%/month and says so', () => {
    const result = blend(input({ personal: { g: Math.log(0.5), n: 50, spanMonths: 24 }, categoryMonthlyPercent: -4 }))
    expect(result.clamped).toBe(true)
    expect(result.monthlyPercent).toBeCloseTo(MONTHLY_MIN * 100, 10)
    expect(result.g).toBeCloseTo(Math.log1p(MONTHLY_MIN), 12)
  })

  it('leaves an ordinary rate alone', () => {
    expect(blend(input({ personal: VECTOR_FIT, categoryMonthlyPercent: 3 })).clamped).toBe(false)
  })

  it('reports gPersonal unclamped, so the UI can explain what was capped', () => {
    const g = Math.log(3)
    const result = blend(input({ personal: { g, n: 50, spanMonths: 24 }, categoryMonthlyPercent: 3 }))
    expect(result.gPersonal).toBe(g)
  })
})

describe('blend — manual override', () => {
  it('always wins, and still reports the lambda it would have used', () => {
    const result = blend(
      input({ personal: VECTOR_FIT, categoryMonthlyPercent: 3, manualMonthlyPercent: 7 }),
    )
    expect(result.manual).toBe(true)
    expect(result.monthlyPercent).toBeCloseTo(7, 10)
    expect(result.g).toBeCloseTo(Math.log1p(0.07), 12)
    expect(result.lambda).toBeCloseTo(0.5, 12)
    expect(result.clamped).toBe(false)
    expect(result.gPersonal).toBe(VECTOR_FIT.g)
  })

  it('is not clamped, even well past the +25% ceiling', () => {
    const result = blend(input({ manualMonthlyPercent: 90 }))
    expect(result.clamped).toBe(false)
    expect(result.monthlyPercent).toBeCloseTo(90, 10)
  })

  it('treats 0 as a real answer — "prices are flat" is an override, not a missing value', () => {
    const result = blend(input({ personal: VECTOR_FIT, categoryMonthlyPercent: 3, manualMonthlyPercent: 0 }))
    expect(result.manual).toBe(true)
    expect(result.g).toBe(0)
    expect(result.monthlyPercent).toBe(0)
  })

  it('ignores an override that has no logarithm, rather than returning NaN', () => {
    for (const manualMonthlyPercent of [-100, -250, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = blend(input({ categoryMonthlyPercent: 3, manualMonthlyPercent }))
      expect(result.manual).toBe(false)
      expect(Number.isFinite(result.g)).toBe(true)
    }
  })
})

describe('replacementNow', () => {
  const base = {
    lastCost: 1_000_000,
    lastObservedAt: 0,
    now: 2 * MS_PER_MONTH,
    lastFx: 100_000,
    fxNow: 120_000,
    gDomestic: Math.log1p(0.03),
    gProduct: Math.log1p(0.03),
  }

  it('vector 4 — s=0.5, FX up 20%, 2 months old → 1,128,308.47', () => {
    expectRelative(replacementNow({ ...base, importDependency: 0.5 }), 1_128_308.47)
  })

  it('vector 5 — s=1 is pure FX: 1,200,000 at any age', () => {
    expectRelative(replacementNow({ ...base, importDependency: 1 }), 1_200_000)
    expectRelative(replacementNow({ ...base, importDependency: 1, now: 17.5 * MS_PER_MONTH }), 1_200_000)
    expectRelative(replacementNow({ ...base, importDependency: 1, now: 0 }), 1_200_000)
  })

  it('rises monotonically with FX_now/FX_at whenever s > 0', () => {
    for (const importDependency of [0.5, 1] as const) {
      let previous = -Infinity
      for (const fxNow of [50_000, 90_000, 100_000, 110_000, 150_000, 400_000]) {
        const value = replacementNow({ ...base, fxNow, importDependency })
        expect(value).toBeGreaterThan(previous)
        previous = value
      }
    }
  })

  it('ignores FX entirely at s = 0', () => {
    const plain = replacementNow({ ...base, importDependency: 0, fxNow: 100_000 })
    for (const fxNow of [1, 100_000, 999_999_999]) {
      expect(replacementNow({ ...base, importDependency: 0, fxNow })).toBe(plain)
    }
    expect(plain).toBeCloseTo(1_000_000 * Math.pow(1.03, 2), 6)
  })

  it('agrees with the plain path at s = 0 without ever dividing by the missing rate', () => {
    const withFx = replacementNow({ ...base, importDependency: 0 })
    const withoutFx = replacementNow({ ...base, importDependency: 0, lastFx: undefined, fxNow: undefined })
    expect(withFx).toBe(withoutFx)
  })

  it('falls back to the blended path when either rate is missing or not positive', () => {
    const expected = 1_000_000 * Math.exp(base.gProduct * 2)
    for (const over of [
      { lastFx: undefined },
      { fxNow: undefined },
      { lastFx: 0 },
      { fxNow: 0 },
      { lastFx: -1 },
      { fxNow: Number.NaN },
    ]) {
      expect(replacementNow({ ...base, importDependency: 1, ...over })).toBeCloseTo(expected, 6)
    }
  })

  it('is unrounded — rounding belongs at the display boundary', () => {
    const value = replacementNow({ ...base, importDependency: 0.5 })
    expect(value).not.toBe(Math.round(value * 100) / 100)
  })
})

describe('forecast', () => {
  it('compounds in log space', () => {
    expect(forecast(1_000_000, Math.log1p(0.03), 3)).toBeCloseTo(1_000_000 * Math.pow(1.03, 3), 6)
  })

  it('is the identity at zero months and at zero growth', () => {
    expect(forecast(1_000_000, 0.05, 0)).toBe(1_000_000)
    expect(forecast(1_000_000, 0, 12)).toBe(1_000_000)
  })

  it('never returns a non-finite price', () => {
    expect(Number.isFinite(forecast(1_000_000, Number.NaN, 3))).toBe(true)
    expect(Number.isFinite(forecast(1_000_000, 1000, 1000))).toBe(true)
  })
})
