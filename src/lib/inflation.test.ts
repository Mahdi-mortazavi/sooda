import { afterEach, describe, expect, it } from 'vitest'
import { MAX_VALUE } from './calc'
import {
  INFLATION_DEFAULT,
  INFLATION_STORAGE_KEY,
  LENS_MONTHS,
  hasInflationOverride,
  annualToMonthlyPercent,
  monthlyRateFromPercent,
  profitStatus,
  LEGACY_ANNUAL_STORAGE_KEY,
  readMonthlyInflationPercent,
  realProfitPercent,
  replacementCost,
  storeMonthlyInflationPercent,
  suggestedPrice,
} from './inflation'

/* Vitest runs in the node environment here, so localStorage has to be stubbed onto globalThis per test. */
function installStorage(initial: Record<string, string> = {}, throws = false): void {
  const data = new Map(Object.entries(initial))
  const guard = (): void => {
    if (throws) throw new Error('storage disabled')
  }
  const stub: Storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => {
      guard()
      return data.get(key) ?? null
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      guard()
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      guard()
      data.set(key, value)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true, writable: true })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

/* The reference vectors are quoted at 40% ANNUAL. Converted exactly, not via a truncated
 * literal — 2.8436 instead of the full value moves replacementCost by five cents. */
const r40 = monthlyRateFromPercent(annualToMonthlyPercent(40))

describe('monthlyRateFromPercent', () => {
  it('is the monthly percent as a fraction — no twelfth root any more', () => {
    /* Until v1.5 this took an ANNUAL percent. Iran's CPI is published monthly, and deriving a
     * monthly pace from a point-to-point annual figure overstates it while inflation slows. */
    expect(monthlyRateFromPercent(3.4)).toBeCloseTo(0.034, 12)
    expect(monthlyRateFromPercent(2.8436)).toBeCloseTo(0.028436, 12)
  })
  it('is exactly 0 at 0%', () => {
    expect(monthlyRateFromPercent(0)).toBe(0)
  })
  it('goes negative under deflation', () => {
    expect(monthlyRateFromPercent(-10)).toBeLessThan(0)
    expect(Number.isFinite(monthlyRateFromPercent(-10))).toBe(true)
  })
})

describe('annualToMonthlyPercent', () => {
  it('converts a v1.4 annual override to the equivalent monthly pace', () => {
    expect(annualToMonthlyPercent(40)).toBeCloseTo(2.8436156, 6)
    // The old bundled default: 89%/yr really is 5.45%/mo, which is why it overstated things.
    expect(annualToMonthlyPercent(89)).toBeCloseTo(5.448033, 6)
  })
  it('compounds back to where it came from', () => {
    expect(Math.pow(1 + annualToMonthlyPercent(89) / 100, 12)).toBeCloseTo(1.89, 10)
  })
  it('is 0 at 0', () => {
    expect(annualToMonthlyPercent(0)).toBe(0)
  })
})

describe('replacementCost', () => {
  it('matches the reference vector (100000 at 40% annual for 3 months)', () => {
    expect(replacementCost(100000, r40, 3)).toBeCloseTo(108775.73, 2)
  })
  it('returns the cost unchanged at months = 0', () => {
    expect(replacementCost(100000, r40, 0)).toBe(100000)
  })
  it('returns the cost unchanged at 0% annual for any horizon', () => {
    const r0 = monthlyRateFromPercent(0)
    expect(r0).toBe(0)
    expect(replacementCost(100000, r0, 12)).toBe(100000)
    expect(replacementCost(100000, r0, 240)).toBe(100000)
  })
  it('falls below cost under deflation and stays finite', () => {
    // Still −10% a YEAR, expressed monthly.
    const deflating = replacementCost(100000, monthlyRateFromPercent(annualToMonthlyPercent(-10)), 6)
    expect(deflating).toBeLessThan(100000)
    expect(deflating).toBeCloseTo(94868.33, 2)
    expect(Number.isFinite(deflating)).toBe(true)
  })
  it('stays finite for a MAX_VALUE-sized cost over 12 months', () => {
    const huge = replacementCost(MAX_VALUE, r40, 12)
    expect(Number.isFinite(huge)).toBe(true)
    expect(huge).toBeGreaterThan(MAX_VALUE)
  })
})

describe('suggestedPrice / realProfitPercent', () => {
  it('matches the reference vectors at 20% target', () => {
    const replacement = replacementCost(100000, r40, 3)
    expect(replacement).toBeCloseTo(108775.73, 2)
    expect(suggestedPrice(replacement, 20)).toBeCloseTo(130530.88, 2)
    expect(realProfitPercent(120000, replacement)).toBeCloseTo(10.32, 2)
  })
  it('passes a user-supplied replacement cost straight through', () => {
    expect(suggestedPrice(250000, 20)).toBe(300000)
    expect(realProfitPercent(300000, 250000)).toBe(20)
  })
  it('reports a real loss when the price lags replacement', () => {
    expect(realProfitPercent(100000, 108775.73)).toBeLessThan(0)
  })
  it('round-trips suggestedPrice back through realProfitPercent', () => {
    const replacement = replacementCost(500000, r40, 6)
    expect(realProfitPercent(suggestedPrice(replacement, 35), replacement)).toBeCloseTo(35, 2)
  })
})

describe('profitStatus', () => {
  it('calls exactly zero real profit losing', () => {
    expect(profitStatus(0, 20)).toBe('losing')
    expect(profitStatus(-0.01, 20)).toBe('losing')
  })
  it('calls exactly 0.8·target healthy and just under it thin', () => {
    expect(profitStatus(16, 20)).toBe('healthy')
    expect(profitStatus(15.99, 20)).toBe('thin')
    expect(profitStatus(25, 20)).toBe('healthy')
  })
  it('treats any real profit as healthy when the target is zero or negative', () => {
    expect(profitStatus(0.01, 0)).toBe('healthy')
    expect(profitStatus(0.01, -5)).toBe('healthy')
    expect(profitStatus(0, 0)).toBe('losing')
    expect(profitStatus(-1, -5)).toBe('losing')
  })
})

describe('inflation source and storage', () => {
  it('bundles the static CPI figure with its provenance', () => {
    expect(INFLATION_DEFAULT.monthlyPercent).toBe(3.4)
    expect(INFLATION_DEFAULT.sourceUrl).toBe('https://www.amar.org.ir/')
    expect(INFLATION_DEFAULT.confidence).toBe('secondary')
    expect(INFLATION_DEFAULT.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('falls back to the default when storage is empty', () => {
    installStorage()
    expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
    expect(hasInflationOverride()).toBe(false)
  })
  it('falls back to the default when storage holds garbage', () => {
    for (const junk of ['', '  ', 'abc', 'NaN', 'Infinity', '-100', '-250']) {
      installStorage({ [INFLATION_STORAGE_KEY]: junk })
      expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
      expect(hasInflationOverride()).toBe(false)
    }
  })
  it('falls back to the default when storage throws', () => {
    installStorage({ [INFLATION_STORAGE_KEY]: '45' }, true)
    expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
    expect(hasInflationOverride()).toBe(false)
    expect(() => storeMonthlyInflationPercent(45)).not.toThrow()
  })
  it('falls back to the default when there is no localStorage at all', () => {
    expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
    expect(hasInflationOverride()).toBe(false)
  })
  it('reads back a stored override', () => {
    installStorage()
    storeMonthlyInflationPercent(45)
    expect(readMonthlyInflationPercent()).toBe(45)
    expect(hasInflationOverride()).toBe(true)
  })
  it('clears the override with null', () => {
    installStorage({ [INFLATION_STORAGE_KEY]: '45' })
    expect(hasInflationOverride()).toBe(true)
    storeMonthlyInflationPercent(null)
    expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
    expect(hasInflationOverride()).toBe(false)
  })
})

describe('the v1.4 annual override migration', () => {
  it('converts a legacy annual value once and retires the old key', () => {
    /* Without this, a shopkeeper's "89% a year" would be read as 89% a MONTH — a factor of
     * 1.89^12 on every restock figure they see. */
    installStorage({ [LEGACY_ANNUAL_STORAGE_KEY]: '89' })
    expect(readMonthlyInflationPercent()).toBeCloseTo(5.448033, 6)
    expect(localStorage.getItem(LEGACY_ANNUAL_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(INFLATION_STORAGE_KEY)).not.toBeNull()
    expect(hasInflationOverride()).toBe(true)
  })
  it('prefers an existing monthly value over a stale legacy one', () => {
    installStorage({ [INFLATION_STORAGE_KEY]: '2.5', [LEGACY_ANNUAL_STORAGE_KEY]: '89' })
    expect(readMonthlyInflationPercent()).toBe(2.5)
  })
  it('ignores legacy garbage rather than migrating it', () => {
    installStorage({ [LEGACY_ANNUAL_STORAGE_KEY]: 'abc' })
    expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
    expect(hasInflationOverride()).toBe(false)
  })
  it('clearing the override also clears the legacy key, so it cannot come back', () => {
    installStorage({ [LEGACY_ANNUAL_STORAGE_KEY]: '89' })
    storeMonthlyInflationPercent(null)
    expect(readMonthlyInflationPercent()).toBe(INFLATION_DEFAULT.monthlyPercent)
    expect(hasInflationOverride()).toBe(false)
  })
})

describe('LENS_MONTHS', () => {
  it('starts at today and grows', () => {
    expect(LENS_MONTHS).toEqual([0, 1, 3, 6, 12])
  })
})
