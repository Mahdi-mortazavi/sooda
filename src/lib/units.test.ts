import { describe, expect, it } from 'vitest'
import { formatAmountWithUnit, isUnit, unitShortLabel } from './units'

describe('formatAmountWithUnit', () => {
  it('formats plain numbers for unit "none"', () => {
    expect(formatAmountWithUnit(1250, 'en', 'none')).toBe('1,250')
    expect(formatAmountWithUnit(1250, 'fa', 'none')).toBe('۱٬۲۵۰')
  })
  it('suffixes Toman in both languages', () => {
    expect(formatAmountWithUnit(250000, 'fa', 'toman')).toBe('۲۵۰٬۰۰۰ تومان')
    expect(formatAmountWithUnit(250000, 'en', 'toman')).toBe('250,000 Toman')
  })
  it('suffixes Rial', () => {
    expect(formatAmountWithUnit(5000, 'fa', 'rial')).toBe('۵٬۰۰۰ ریال')
  })
  it('prefixes $ and € in English', () => {
    expect(formatAmountWithUnit(19.99, 'en', 'usd')).toBe('$19.99')
    expect(formatAmountWithUnit(19.99, 'en', 'eur')).toBe('€19.99')
  })
  it('uses Persian currency words in Farsi', () => {
    expect(formatAmountWithUnit(20, 'fa', 'usd')).toBe('۲۰ دلار')
    expect(formatAmountWithUnit(20, 'fa', 'eur')).toBe('۲۰ یورو')
  })
})

describe('isUnit / unitShortLabel', () => {
  it('accepts only known units', () => {
    expect(isUnit('toman')).toBe(true)
    expect(isUnit('gbp')).toBe(false)
    expect(isUnit(null)).toBe(false)
  })
  it('provides picker labels', () => {
    expect(unitShortLabel('toman', 'fa')).toBe('تومان')
    expect(unitShortLabel('usd', 'en')).toBe('$')
    expect(unitShortLabel('none', 'en')).toBe('—')
  })
})
