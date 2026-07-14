import { describe, expect, it } from 'vitest'
import { buildShareQuery, parseShareQuery } from './share'

describe('buildShareQuery', () => {
  it('encodes mode, inputs and unit', () => {
    expect(buildShareQuery({ mode: 'profit', a: 1250, b: 24, unit: 'toman' })).toBe('?m=profit&a=1250&b=24&u=toman')
  })
  it('omits the default unit', () => {
    expect(buildShareQuery({ mode: 'discount', a: 89.99, b: 30, unit: 'none' })).toBe('?m=discount&a=89.99&b=30')
  })
  it('builds mode-only links for shortcuts', () => {
    expect(buildShareQuery({ mode: 'sell', a: null, b: null, unit: 'none' })).toBe('?m=sell')
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
  it('accepts mode-only shortcut links', () => {
    expect(parseShareQuery('?m=discount')).toEqual({ mode: 'discount', a: null, b: null, unit: 'none' })
  })
  it('rejects unknown modes', () => {
    expect(parseShareQuery('?m=magic&a=1&b=2')).toBeNull()
  })
  it('drops broken numbers but keeps the mode', () => {
    expect(parseShareQuery('?m=profit&a=abc&b=2')).toEqual({ mode: 'profit', a: null, b: null, unit: 'none' })
    expect(parseShareQuery('?m=profit&a=1')).toEqual({ mode: 'profit', a: null, b: null, unit: 'none' })
  })
  it('ignores an invalid unit but keeps the calculation', () => {
    expect(parseShareQuery('?m=profit&a=1&b=2&u=gbp')).toEqual({ mode: 'profit', a: 1, b: 2, unit: 'none' })
  })
  it('returns null for empty queries', () => {
    expect(parseShareQuery('')).toBeNull()
    expect(parseShareQuery('?')).toBeNull()
  })
})
