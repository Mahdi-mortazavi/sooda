import { describe, expect, it } from 'vitest'
import { formatNumber, normalizeDigits, parseAmount } from './numbers'

describe('normalizeDigits', () => {
  it('converts Persian digits to ASCII', () => {
    expect(normalizeDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890')
  })
  it('converts Arabic-Indic digits to ASCII', () => {
    expect(normalizeDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890')
  })
  it('converts Arabic decimal separator ٫ to a dot', () => {
    expect(normalizeDigits('۱۲٫۵')).toBe('12.5')
  })
  it('treats Persian-keyboard slash as decimal separator', () => {
    expect(normalizeDigits('۱۲/۵')).toBe('12.5')
  })
  it('leaves ASCII untouched', () => {
    expect(normalizeDigits('123.45')).toBe('123.45')
  })
})

describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount('1250')).toBe(1250)
    expect(parseAmount('12.75')).toBe(12.75)
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount('-3.2')).toBe(-3.2)
  })
  it('parses Persian digits', () => {
    expect(parseAmount('۲۵۰۰')).toBe(2500)
    expect(parseAmount('۱۲٫۷۵')).toBe(12.75)
  })
  it('strips grouping separators (Latin, Persian, spaces)', () => {
    expect(parseAmount('1,250,000')).toBe(1250000)
    expect(parseAmount('۱٬۲۵۰٬۰۰۰')).toBe(1250000)
    expect(parseAmount('1 250 000')).toBe(1250000)
  })
  it('rejects garbage', () => {
    expect(Number.isNaN(parseAmount(''))).toBe(true)
    expect(Number.isNaN(parseAmount('abc'))).toBe(true)
    expect(Number.isNaN(parseAmount('1.2.3'))).toBe(true)
    expect(Number.isNaN(parseAmount('12x'))).toBe(true)
    expect(Number.isNaN(parseAmount('--5'))).toBe(true)
    expect(Number.isNaN(parseAmount('.'))).toBe(true)
  })
})

describe('formatNumber', () => {
  it('formats with en-US grouping for English', () => {
    expect(formatNumber(1250000, 'en')).toBe('1,250,000')
    expect(formatNumber(12.5, 'en')).toBe('12.5')
  })
  it('formats with Persian digits for Farsi', () => {
    expect(formatNumber(1250000, 'fa')).toBe('۱٬۲۵۰٬۰۰۰')
    expect(formatNumber(12.5, 'fa')).toBe('۱۲٫۵')
  })
  it('rounds display to 2 decimals by default', () => {
    expect(formatNumber(3.14159, 'en')).toBe('3.14')
  })
  it('never renders -0', () => {
    expect(formatNumber(-0, 'en')).toBe('0')
  })
  it('handles non-finite values gracefully', () => {
    expect(formatNumber(Number.NaN, 'en')).toBe('—')
    expect(formatNumber(Number.POSITIVE_INFINITY, 'en')).toBe('—')
  })
})
