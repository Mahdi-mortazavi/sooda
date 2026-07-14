import { describe, expect, it } from 'vitest'
import {
  MAX_VALUE,
  MODE_RULES,
  calcDiscount,
  calcFromProfitPercent,
  calcReverseDiscount,
  calcFromSellingPrice,
  round2,
  validateValue,
} from './calc'

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(1.0049)).toBe(1)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
  it('never returns -0', () => {
    expect(Object.is(round2(-0.0001), 0)).toBe(true)
  })
})

describe('calcFromProfitPercent (mode 1)', () => {
  it('computes selling price and profit amount', () => {
    expect(calcFromProfitPercent(100, 25)).toEqual({ sellingPrice: 125, profitAmount: 25 })
    expect(calcFromProfitPercent(80, 12.5)).toEqual({ sellingPrice: 90, profitAmount: 10 })
  })
  it('handles 0% profit', () => {
    expect(calcFromProfitPercent(49.99, 0)).toEqual({ sellingPrice: 49.99, profitAmount: 0 })
  })
  it('handles decimal prices', () => {
    expect(calcFromProfitPercent(19.99, 10)).toEqual({ sellingPrice: 21.99, profitAmount: 2 })
  })
  it('handles large percentages', () => {
    expect(calcFromProfitPercent(10, 1000)).toEqual({ sellingPrice: 110, profitAmount: 100 })
  })
})

describe('calcFromSellingPrice (mode 2)', () => {
  it('computes profit % and amount', () => {
    expect(calcFromSellingPrice(100, 150)).toEqual({ profitPercent: 50, profitAmount: 50, isLoss: false })
  })
  it('flags a loss with negative values', () => {
    expect(calcFromSellingPrice(200, 150)).toEqual({ profitPercent: -25, profitAmount: -50, isLoss: true })
  })
  it('handles break-even', () => {
    expect(calcFromSellingPrice(75.5, 75.5)).toEqual({ profitPercent: 0, profitAmount: 0, isLoss: false })
  })
  it('handles selling at zero (total loss)', () => {
    expect(calcFromSellingPrice(40, 0)).toEqual({ profitPercent: -100, profitAmount: -40, isLoss: true })
  })
  it('rounds percentages to 2 decimals', () => {
    expect(calcFromSellingPrice(3, 4).profitPercent).toBe(33.33)
  })
})

describe('calcDiscount (mode 3)', () => {
  it('computes final price and saved amount', () => {
    expect(calcDiscount(200, 15)).toEqual({ finalPrice: 170, savedAmount: 30 })
  })
  it('handles 0% discount', () => {
    expect(calcDiscount(59.9, 0)).toEqual({ finalPrice: 59.9, savedAmount: 0 })
  })
  it('handles 100% discount', () => {
    expect(calcDiscount(59.9, 100)).toEqual({ finalPrice: 0, savedAmount: 59.9 })
  })
  it('handles fractional results', () => {
    expect(calcDiscount(99.99, 33)).toEqual({ finalPrice: 66.99, savedAmount: 33 })
  })
})

describe('validateValue', () => {
  it('requires a value', () => {
    expect(validateValue(NaN, { positive: true }, true)).toBe('required')
  })
  it('rejects NaN input', () => {
    expect(validateValue(NaN, { positive: true }, false)).toBe('invalid')
  })
  it('rejects non-positive purchase prices', () => {
    expect(validateValue(0, { positive: true }, false)).toBe('notPositive')
    expect(validateValue(-5, { positive: true }, false)).toBe('notPositive')
    expect(validateValue(0.01, { positive: true }, false)).toBeNull()
  })
  it('rejects negative where non-negative required', () => {
    expect(validateValue(-1, { nonNegative: true }, false)).toBe('negative')
    expect(validateValue(0, { nonNegative: true }, false)).toBeNull()
  })
  it('caps absurd values', () => {
    expect(validateValue(MAX_VALUE + 1, { positive: true }, false)).toBe('tooLarge')
    expect(validateValue(MAX_VALUE, { positive: true }, false)).toBeNull()
  })
  it('enforces discount range 0–100', () => {
    expect(validateValue(101, { percentRange: true }, false)).toBe('discountRange')
    expect(validateValue(-1, { percentRange: true }, false)).toBe('discountRange')
    expect(validateValue(100, { percentRange: true }, false)).toBeNull()
    expect(validateValue(0, { percentRange: true }, false)).toBeNull()
  })
  it('has rules for every mode', () => {
    expect(Object.keys(MODE_RULES).sort()).toEqual(['discount', 'profit', 'rdiscount', 'sell'])
  })
})

describe('calcReverseDiscount (mode 4)', () => {
  it('recovers the original price from the final price', () => {
    expect(calcReverseDiscount(170, 15)).toEqual({ originalPrice: 200, savedAmount: 30 })
  })
  it('handles 0% (no discount)', () => {
    expect(calcReverseDiscount(59.9, 0)).toEqual({ originalPrice: 59.9, savedAmount: 0 })
  })
  it('round-trips with calcDiscount', () => {
    const { finalPrice } = calcDiscount(89.99, 30)
    const { originalPrice } = calcReverseDiscount(finalPrice, 30)
    expect(Math.abs(originalPrice - 89.99)).toBeLessThan(0.02)
  })
  it('handles fractional discounts', () => {
    expect(calcReverseDiscount(87.5, 12.5)).toEqual({ originalPrice: 100, savedAmount: 12.5 })
  })
  it('rejects 100% via validation rule', () => {
    expect(validateValue(100, { percentBelow100: true }, false)).toBe('reverseDiscountRange')
    expect(validateValue(99.99, { percentBelow100: true }, false)).toBeNull()
    expect(validateValue(-1, { percentBelow100: true }, false)).toBe('reverseDiscountRange')
  })
})
