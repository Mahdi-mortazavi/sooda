import { describe, expect, it } from 'vitest'
import { addMonths } from './dates'
import { monthlyRateFromPercent } from './inflation'
import {
  INSTALLMENT_COUNTS,
  annuityFactor,
  buildSchedule,
  calcInstallmentForward,
  calcInstallmentReverse,
  validateInstallment,
} from './installment'

const r40 = monthlyRateFromPercent(40)
const P = 10_000_000

describe('annuityFactor', () => {
  it('matches the reference vector at 40% annual over 6 months', () => {
    expect(annuityFactor(r40, 6)).toBeCloseTo(5.445383, 6)
  })
  it('collapses to n at a zero rate', () => {
    expect(annuityFactor(0, 6)).toBe(6)
    expect(annuityFactor(0, 24)).toBe(24)
  })
  it('discounts a single payment by one month', () => {
    expect(annuityFactor(r40, 1)).toBeCloseTo(1 / (1 + r40), 10)
  })
  it('exceeds n under deflation', () => {
    const factor = annuityFactor(monthlyRateFromPercent(-10), 6)
    expect(factor).toBeGreaterThan(6)
    expect(Number.isFinite(factor)).toBe(true)
  })
})

describe('calcInstallmentForward', () => {
  it('matches the reference vector: P=10,000,000 D=0 n=6 at 40% annual', () => {
    const result = calcInstallmentForward(P, 0, 6, r40)
    expect(result.annuityFactor).toBeCloseTo(5.445383, 6)
    expect(result.installment).toBeCloseTo(1836418.28, 2)
    expect(result.total).toBeCloseTo(11018509.68, 2)
    expect(result.markupPercent).toBeCloseTo(10.19, 2)
    expect(result.flatMonthlyPercent).toBeCloseTo(1.7, 2)
    expect(result.financed).toBe(P)
  })
  it('matches the reference vector: P=10,000,000 D=2,000,000 n=12 at 40% annual', () => {
    const result = calcInstallmentForward(P, 2_000_000, 12, r40)
    expect(result.installment).toBeCloseTo(796212.36, 2)
    expect(result.total).toBeCloseTo(11554548.32, 2)
    expect(result.markupPercent).toBeCloseTo(15.55, 2)
    expect(result.flatMonthlyPercent).toBeCloseTo(1.62, 2)
    expect(result.financed).toBe(8_000_000)
  })
  it('charges nothing extra at a zero rate', () => {
    const result = calcInstallmentForward(P, 1_000_000, 6, 0)
    expect(result.annuityFactor).toBe(6)
    expect(result.installment).toBe(9_000_000 / 6)
    expect(result.total).toBe(P)
    expect(result.markupPercent).toBe(0)
    expect(result.flatMonthlyPercent).toBe(0)
  })
  it('handles a single instalment', () => {
    const result = calcInstallmentForward(P, 0, 1, r40)
    expect(result.installment).toBeCloseTo(P * (1 + r40), 2)
    expect(result.total).toBeCloseTo(P * (1 + r40), 2)
    expect(result.flatMonthlyPercent).toBeCloseTo(r40 * 100, 2)
  })
  it('discounts rather than marks up under deflation', () => {
    const result = calcInstallmentForward(P, 0, 6, monthlyRateFromPercent(-10))
    expect(result.installment).toBeLessThan(P / 6)
    expect(result.total).toBeLessThan(P)
    expect(result.markupPercent).toBeLessThan(0)
    expect(result.flatMonthlyPercent).toBeLessThan(0)
    expect(Number.isFinite(result.installment)).toBe(true)
    expect(Number.isFinite(result.total)).toBe(true)
    expect(Number.isFinite(result.markupPercent)).toBe(true)
  })
  it('shrinks the instalment as the down payment grows', () => {
    const none = calcInstallmentForward(P, 0, 12, r40)
    const half = calcInstallmentForward(P, P / 2, 12, r40)
    expect(half.installment).toBeLessThan(none.installment)
    expect(half.markupPercent).toBeLessThan(none.markupPercent)
  })
})

describe('calcInstallmentReverse', () => {
  it('matches the reference vector: P=10,000,000 D=0 n=6 at a flat 3%/month', () => {
    const result = calcInstallmentReverse(P, 0, 6, 3, r40)
    expect(result.installment).toBeCloseTo(1966666.67, 2)
    expect(result.presentValue).toBeCloseTo(10709252.29, 2)
    expect(result.realGainPercent).toBeCloseTo(7.09, 2)
    expect(result.gainAmount).toBeCloseTo(709252.29, 2)
    expect(result.total).toBeCloseTo(11800000, 2)
  })
  it('breaks even at a zero flat rate and a zero real rate', () => {
    const result = calcInstallmentReverse(P, 0, 6, 0, 0)
    expect(result.installment).toBeCloseTo(P / 6, 2)
    expect(result.presentValue).toBe(P)
    expect(result.realGainPercent).toBe(0)
    expect(result.gainAmount).toBe(0)
  })
  it('reports a real loss when the flat rate lags inflation', () => {
    const result = calcInstallmentReverse(P, 0, 12, 1, r40)
    expect(result.realGainPercent).toBeLessThan(0)
    expect(result.gainAmount).toBeLessThan(0)
  })
  it('counts the down payment at full value', () => {
    const result = calcInstallmentReverse(P, 4_000_000, 6, 3, r40)
    expect(result.presentValue).toBeGreaterThan(4_000_000)
    expect(result.total).toBeCloseTo(4_000_000 + 6 * result.installment, 2)
  })
})

describe('validateInstallment', () => {
  it('accepts a sane plan', () => {
    expect(validateInstallment(P, 0, 6)).toBeNull()
    expect(validateInstallment(P, 2_000_000, 12)).toBeNull()
    for (const n of INSTALLMENT_COUNTS) expect(validateInstallment(P, 0, n)).toBeNull()
  })
  it('rejects a down payment at or above the cash price', () => {
    expect(validateInstallment(P, P, 6)).toBe('downPaymentTooHigh')
    expect(validateInstallment(P, P + 1, 6)).toBe('downPaymentTooHigh')
  })
  it('rejects a non-positive or fractional instalment count', () => {
    expect(validateInstallment(P, 0, 6.5)).toBe('installmentCountInvalid')
    expect(validateInstallment(P, 0, 0)).toBe('installmentCountInvalid')
    expect(validateInstallment(P, 0, -3)).toBe('installmentCountInvalid')
    expect(validateInstallment(P, 0, Number.NaN)).toBe('installmentCountInvalid')
  })
})

describe('buildSchedule', () => {
  const startAt = Date.UTC(2026, 8, 15, 9, 30)

  it('produces n rows with strictly increasing due dates', () => {
    const rows = buildSchedule(1836418.28, 6, startAt)
    expect(rows).toHaveLength(6)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]?.dueAt ?? 0).toBeGreaterThan(rows[i - 1]?.dueAt ?? 0)
      expect(rows[i]?.index).toBe(i + 1)
    }
  })
  it('falls due one whole month after the start, not on it', () => {
    const rows = buildSchedule(1000, 3, startAt)
    expect(rows[0]?.dueAt).toBe(addMonths(startAt, 1))
    expect(rows[0]?.dueAt ?? 0).toBeGreaterThan(startAt)
    expect(rows[2]?.dueAt).toBe(addMonths(startAt, 3))
  })
  it('amounts sum to n × instalment', () => {
    const rows = buildSchedule(1836418.28, 6, startAt)
    const sum = rows.reduce((acc, row) => acc + row.amount, 0)
    expect(sum).toBeCloseTo(6 * 1836418.28, 2)
  })
  it('returns no rows for a zero-length plan', () => {
    expect(buildSchedule(1000, 0, startAt)).toEqual([])
  })
})
