import { describe, expect, it } from 'vitest'
import { addMonths, formatDate, monthsBetween } from './dates'

/** Persian-calendar parts of a timestamp, for asserting month stepping. */
const jalali = (ms: number) =>
  new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(ms))
    .reduce<Record<string, number>>((acc, p) => {
      if (p.type === 'year' || p.type === 'month' || p.type === 'day') acc[p.type] = Number.parseInt(p.value, 10)
      return acc
    }, {})

// 2026-09-15 is 24 Shahrivar 1405.
const REF = new Date(2026, 8, 15, 10, 30).getTime()

describe('addMonths (Persian calendar)', () => {
  it('is a no-op for zero months', () => {
    expect(addMonths(REF, 0)).toBe(REF)
  })

  it('steps one Persian month forward keeping the day of month', () => {
    const next = addMonths(REF, 1)
    expect(jalali(next)).toEqual({ year: 1405, month: 7, day: 24 })
  })

  it('steps six months forward across the 31→30 day boundary', () => {
    const next = addMonths(REF, 6)
    expect(jalali(next)).toEqual({ year: 1405, month: 12, day: 24 })
  })

  it('rolls into the next Persian year', () => {
    const next = addMonths(REF, 12)
    expect(jalali(next)).toEqual({ year: 1406, month: 6, day: 24 })
  })

  it('clamps when the target month is shorter', () => {
    // 31 Farvardin 1405 → Mehr has only 30 days.
    const farvardin31 = addMonths(new Date(2026, 3, 20, 9, 0).getTime(), 0)
    expect(jalali(farvardin31).day).toBe(31)
    const mehr = addMonths(farvardin31, 6)
    expect(jalali(mehr)).toEqual({ year: 1405, month: 7, day: 30 })
  })

  it('preserves the time of day', () => {
    const next = new Date(addMonths(REF, 3))
    expect(next.getHours()).toBe(10)
    expect(next.getMinutes()).toBe(30)
  })

  it('steps backwards too', () => {
    expect(jalali(addMonths(REF, -6))).toEqual({ year: 1404, month: 12, day: 24 })
  })

  it('produces a strictly increasing 24-month schedule', () => {
    let prev = REF
    for (let i = 1; i <= 24; i++) {
      const due = addMonths(REF, i)
      expect(due).toBeGreaterThan(prev)
      prev = due
    }
  })
})

describe('monthsBetween', () => {
  it('is zero for equal or reversed timestamps', () => {
    expect(monthsBetween(REF, REF)).toBe(0)
    expect(monthsBetween(REF, REF - 1000)).toBe(0)
  })

  it('counts whole months only', () => {
    expect(monthsBetween(REF, addMonths(REF, 1) - 1000)).toBe(0)
    expect(monthsBetween(REF, addMonths(REF, 1))).toBe(1)
    expect(monthsBetween(REF, addMonths(REF, 13))).toBe(13)
  })
})

describe('formatDate', () => {
  it('renders Jalali for Persian and Gregorian for English', () => {
    expect(formatDate(REF, 'fa')).toContain('۱۴۰۵')
    expect(formatDate(REF, 'en')).toContain('2026')
  })
})
