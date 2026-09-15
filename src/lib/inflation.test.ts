import { afterEach, describe, expect, it } from 'vitest'
import { MAX_VALUE } from './calc'
import {
  INFLATION_DEFAULT,
  INFLATION_STORAGE_KEY,
  LENS_MONTHS,
  hasInflationOverride,
  monthlyRate,
  monthlyRateFromPercent,
  profitStatus,
  readAnnualInflationPercent,
  realProfitPercent,
  replacementCost,
  storeAnnualInflationPercent,
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

const r40 = monthlyRateFromPercent(40)

describe('monthlyRate', () => {
  it('matches the reference vector for 40% annual', () => {
    expect(monthlyRate(0.4)).toBeCloseTo(0.028436, 6)
    expect(monthlyRateFromPercent(40)).toBeCloseTo(0.028436, 6)
  })
  it('compounds back to the annual figure over 12 months', () => {
    expect(Math.pow(1 + r40, 12)).toBeCloseTo(1.4, 10)
  })
  it('is exactly 0 at 0% annual', () => {
    expect(monthlyRate(0)).toBe(0)
    expect(monthlyRateFromPercent(0)).toBe(0)
  })
  it('goes negative under deflation', () => {
    expect(monthlyRateFromPercent(-10)).toBeLessThan(0)
    expect(Number.isFinite(monthlyRateFromPercent(-10))).toBe(true)
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
    const deflating = replacementCost(100000, monthlyRateFromPercent(-10), 6)
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
    expect(INFLATION_DEFAULT.annualPercent).toBe(89)
    expect(INFLATION_DEFAULT.sourceUrl).toBe('https://www.amar.org.ir/')
    expect(INFLATION_DEFAULT.confidence).toBe('secondary')
    expect(INFLATION_DEFAULT.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('falls back to the default when storage is empty', () => {
    installStorage()
    expect(readAnnualInflationPercent()).toBe(INFLATION_DEFAULT.annualPercent)
    expect(hasInflationOverride()).toBe(false)
  })
  it('falls back to the default when storage holds garbage', () => {
    for (const junk of ['', '  ', 'abc', 'NaN', 'Infinity', '-100', '-250']) {
      installStorage({ [INFLATION_STORAGE_KEY]: junk })
      expect(readAnnualInflationPercent()).toBe(INFLATION_DEFAULT.annualPercent)
      expect(hasInflationOverride()).toBe(false)
    }
  })
  it('falls back to the default when storage throws', () => {
    installStorage({ [INFLATION_STORAGE_KEY]: '45' }, true)
    expect(readAnnualInflationPercent()).toBe(INFLATION_DEFAULT.annualPercent)
    expect(hasInflationOverride()).toBe(false)
    expect(() => storeAnnualInflationPercent(45)).not.toThrow()
  })
  it('falls back to the default when there is no localStorage at all', () => {
    expect(readAnnualInflationPercent()).toBe(INFLATION_DEFAULT.annualPercent)
    expect(hasInflationOverride()).toBe(false)
  })
  it('reads back a stored override', () => {
    installStorage()
    storeAnnualInflationPercent(45)
    expect(readAnnualInflationPercent()).toBe(45)
    expect(hasInflationOverride()).toBe(true)
  })
  it('clears the override with null', () => {
    installStorage({ [INFLATION_STORAGE_KEY]: '45' })
    expect(hasInflationOverride()).toBe(true)
    storeAnnualInflationPercent(null)
    expect(readAnnualInflationPercent()).toBe(INFLATION_DEFAULT.annualPercent)
    expect(hasInflationOverride()).toBe(false)
  })
})

describe('LENS_MONTHS', () => {
  it('starts at today and grows', () => {
    expect(LENS_MONTHS).toEqual([0, 1, 3, 6, 12])
  })
})
