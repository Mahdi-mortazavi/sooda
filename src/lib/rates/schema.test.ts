import { describe, expect, it } from 'vitest'
import { categoryMonthlyPercent, validateRates, type RatesFile } from './schema'

const valid = {
  schema: 1,
  updatedAt: '2026-09-15',
  cpi: {
    source: { name: 'Statistical Center of Iran', url: 'https://www.amar.org.ir/' },
    asOf: '2026-08',
    overallMonthlyPercent: 3.4,
    categories: { food: 3.6, apparel: 2.9, home: null },
  },
  fx: {
    source: { name: 'Example', url: 'https://example.com' },
    pair: 'USD/IRT',
    series: [
      ['2026-09-02', 101000],
      ['2026-09-01', 100000],
    ],
  },
}

const ok = (raw: unknown): RatesFile => {
  const result = validateRates(raw)
  if (!result.ok) throw new Error(`expected valid, got ${result.problem}`)
  return result.data
}

describe('validateRates', () => {
  it('accepts a well-formed file', () => {
    const data = ok(valid)
    expect(data.cpi.overallMonthlyPercent).toBe(3.4)
    expect(data.cpi.categories.food).toBe(3.6)
    expect(data.fx.series).toHaveLength(2)
  })

  it('sorts the series so the newest point is always last', () => {
    expect(ok(valid).fx.series.map(([d]) => d)).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('accepts a file whose figures are all still null', () => {
    const empty = {
      ...valid,
      updatedAt: null,
      cpi: { ...valid.cpi, asOf: null, overallMonthlyPercent: null, categories: {} },
      fx: { ...valid.fx, series: [] },
    }
    const data = ok(empty)
    expect(data.cpi.overallMonthlyPercent).toBeNull()
    expect(data.fx.series).toEqual([])
  })

  it('drops an unknown category rather than failing the whole file', () => {
    const data = ok({ ...valid, cpi: { ...valid.cpi, categories: { food: 3.6, unicorns: 9 } } })
    expect(Object.keys(data.cpi.categories)).toEqual(['food'])
  })

  it('never treats "other" as its own category', () => {
    const data = ok({ ...valid, cpi: { ...valid.cpi, categories: { other: 99 } } })
    expect(Object.keys(data.cpi.categories)).toEqual([])
  })

  it.each([
    ['a non-object', 42, 'notObject'],
    ['null', null, 'notObject'],
    ['an array', [], 'notObject'],
    ['a future schema', { ...valid, schema: 2 }, 'unsupportedSchema'],
    ['a missing cpi block', { ...valid, cpi: undefined }, 'badCpi'],
    ['a cpi without a source', { ...valid, cpi: { ...valid.cpi, source: {} } }, 'badCpi'],
    ['a non-numeric cpi figure', { ...valid, cpi: { ...valid.cpi, overallMonthlyPercent: '3.4' } }, 'badCpi'],
    ['a NaN cpi figure', { ...valid, cpi: { ...valid.cpi, overallMonthlyPercent: NaN } }, 'badCpi'],
    ['a malformed asOf', { ...valid, cpi: { ...valid.cpi, asOf: '2026' } }, 'badCpi'],
    ['a missing fx block', { ...valid, fx: undefined }, 'badFx'],
    ['a non-array series', { ...valid, fx: { ...valid.fx, series: {} } }, 'badFx'],
    ['a malformed date', { ...valid, fx: { ...valid.fx, series: [['09-01', 1]] } }, 'badFx'],
    ['a zero rate', { ...valid, fx: { ...valid.fx, series: [['2026-09-01', 0]] } }, 'badFx'],
    ['a negative rate', { ...valid, fx: { ...valid.fx, series: [['2026-09-01', -5]] } }, 'badFx'],
    ['a short tuple', { ...valid, fx: { ...valid.fx, series: [['2026-09-01']] } }, 'badFx'],
  ])('rejects %s', (_label, raw, problem) => {
    const result = validateRates(raw)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.problem).toBe(problem)
  })

  it('never throws, whatever it is handed', () => {
    for (const raw of [undefined, '', 0, Symbol('x'), () => 0, new Map(), { schema: 1 }]) {
      expect(() => validateRates(raw)).not.toThrow()
    }
  })
})

describe('categoryMonthlyPercent', () => {
  const data = ok(valid)

  it('uses the category figure when there is one', () => {
    expect(categoryMonthlyPercent(data, 'apparel')).toBe(2.9)
  })

  it('falls back to the overall index for a category with no figure', () => {
    expect(categoryMonthlyPercent(data, 'home')).toBe(3.4)
    expect(categoryMonthlyPercent(data, 'auto')).toBe(3.4)
  })

  it('always resolves "other" to the overall index', () => {
    expect(categoryMonthlyPercent(data, 'other')).toBe(3.4)
  })

  it('returns null when even the overall index is missing', () => {
    const bare = ok({ ...valid, cpi: { ...valid.cpi, overallMonthlyPercent: null, categories: {} } })
    expect(categoryMonthlyPercent(bare, 'auto')).toBeNull()
  })
})
