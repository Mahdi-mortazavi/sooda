import { describe, expect, it } from 'vitest'
import { buildModeShareQuery, buildShareQuery, parseModeShareQuery, parseShareQuery, parseTabQuery } from './share'

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

describe('buildModeShareQuery (v2)', () => {
  it('encodes named fields in declaration order', () => {
    expect(buildModeShareQuery({ mode: 'profit', values: { margin: 20, cost: 100000 }, unit: 'toman' })).toBe(
      '?m=profit&v=cost:100000,margin:20&u=toman',
    )
  })
  it('omits the default unit and skips missing fields', () => {
    expect(buildModeShareQuery({ mode: 'discount', values: { price: 89.99 }, unit: 'none' })).toBe(
      '?m=discount&v=price:89.99',
    )
  })
  it('builds a mode-only link when nothing is filled in', () => {
    expect(buildModeShareQuery({ mode: 'sell', values: {}, unit: 'none' })).toBe('?m=sell')
  })
})

describe('parseModeShareQuery', () => {
  it('round-trips the v2 format', () => {
    const params = { mode: 'rdiscount' as const, values: { final: 62.99, off: 30 }, unit: 'eur' as const }
    expect(parseModeShareQuery(buildModeShareQuery(params))).toEqual(params)
  })
  it('still reads legacy v1 links, mapping a/b onto the first two fields', () => {
    expect(parseModeShareQuery('?m=profit&a=1250&b=24&u=toman')).toEqual({
      mode: 'profit',
      values: { cost: 1250, margin: 24 },
      unit: 'toman',
    })
    expect(parseModeShareQuery('?m=sell&a=200&b=150')).toEqual({
      mode: 'sell',
      values: { cost: 200, price: 150 },
      unit: 'none',
    })
  })
  it('accepts mode-only shortcut links from the manifest', () => {
    expect(parseModeShareQuery('?m=discount')).toEqual({ mode: 'discount', values: {}, unit: 'none' })
  })
  it('rejects unknown modes', () => {
    expect(parseModeShareQuery('?m=magic&v=cost:1')).toBeNull()
    expect(parseModeShareQuery('')).toBeNull()
    expect(parseModeShareQuery('?')).toBeNull()
  })
  it('drops unknown keys and broken numbers but keeps the rest', () => {
    expect(parseModeShareQuery('?m=profit&v=cost:100,bogus:5,margin:abc')).toEqual({
      mode: 'profit',
      values: { cost: 100 },
      unit: 'none',
    })
  })
  it('ignores an invalid unit but keeps the calculation', () => {
    expect(parseModeShareQuery('?m=profit&v=cost:1,margin:2&u=gbp')).toEqual({
      mode: 'profit',
      values: { cost: 1, margin: 2 },
      unit: 'none',
    })
  })
  it('tolerates a percent-encoded v list', () => {
    expect(parseModeShareQuery('?m=profit&v=cost%3A100%2Cmargin%3A20')).toEqual({
      mode: 'profit',
      values: { cost: 100, margin: 20 },
      unit: 'none',
    })
  })
})

describe('parseTabQuery', () => {
  it('reads the products shortcut', () => {
    expect(parseTabQuery('?tab=products')).toBe('products')
    expect(parseTabQuery('?tab=calculator')).toBe('calculator')
  })
  it('returns null for anything else', () => {
    expect(parseTabQuery('?tab=nope')).toBeNull()
    expect(parseTabQuery('?m=profit')).toBeNull()
    expect(parseTabQuery('')).toBeNull()
  })
})
