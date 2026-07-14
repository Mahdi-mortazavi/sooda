import { describe, expect, it } from 'vitest'
import { buildShareQuery, parseShareQuery } from './share'

describe('buildShareQuery', () => {
  it('encodes mode, inputs and unit', () => {
    expect(buildShareQuery({ mode: 'profit', a: 1250, b: 24, unit: 'toman' })).toBe('?m=profit&a=1250&b=24&u=toman')
  })
  it('omits the default unit', () => {
    expect(buildShareQuery({ mode: 'discount', a: 89.99, b: 30, unit: 'none' })).toBe('?m=discount&a=89.99&b=30')
  })
})

describe('parseShareQuery', () => {
  it('round-trips what buildShareQuery produces', () => {
    const params = { mode: 'rdiscount' as const, a: 62.99, b: 30, unit: 'eur' as const }
    expect(parseShareQuery(buildShareQuery(params))).toEqual(params)
  })
  it('defaults unit to none', () => {
    expect(parseShareQuery('?m=sell&a=200&b=150')).toEqual({ mode: 'sell', a: 200, b: 150, unit: 'none' })
  })
  it('rejects unknown modes', () => {
    expect(parseShareQuery('?m=magic&a=1&b=2')).toBeNull()
  })
  it('rejects non-numeric inputs', () => {
    expect(parseShareQuery('?m=profit&a=abc&b=2')).toBeNull()
    expect(parseShareQuery('?m=profit&a=1')).toBeNull()
  })
  it('ignores an invalid unit but keeps the calculation', () => {
    expect(parseShareQuery('?m=profit&a=1&b=2&u=gbp')).toEqual({ mode: 'profit', a: 1, b: 2, unit: 'none' })
  })
  it('returns null for empty queries', () => {
    expect(parseShareQuery('')).toBeNull()
    expect(parseShareQuery('?')).toBeNull()
  })
})
