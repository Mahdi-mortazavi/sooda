/** Pure calculation engine for Sooda's three modes. All money results rounded to 2 decimals. */

export type Mode = 'profit' | 'sell' | 'discount'

export const MODES: readonly Mode[] = ['profit', 'sell', 'discount'] as const

/** Maximum sensible magnitude for any money/percent input. */
export const MAX_VALUE = 999_999_999_999

export type ValidationError = 'required' | 'invalid' | 'negative' | 'notPositive' | 'tooLarge' | 'discountRange'

/** Round to 2 decimal places, avoiding floating point artifacts (e.g. 0.1+0.2). */
export function round2(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export interface ProfitPercentResult {
  sellingPrice: number
  profitAmount: number
}

/** Mode 1 — purchase price + desired profit % → selling price and profit amount. */
export function calcFromProfitPercent(purchasePrice: number, profitPercent: number): ProfitPercentResult {
  const profitAmount = round2((purchasePrice * profitPercent) / 100)
  const sellingPrice = round2(purchasePrice + (purchasePrice * profitPercent) / 100)
  return { sellingPrice, profitAmount }
}

export interface SellingPriceResult {
  profitPercent: number
  profitAmount: number
  isLoss: boolean
}

/** Mode 2 — purchase price + selling price → profit % and profit amount (negative = loss). */
export function calcFromSellingPrice(purchasePrice: number, sellingPrice: number): SellingPriceResult {
  const profitAmount = round2(sellingPrice - purchasePrice)
  const profitPercent = round2(((sellingPrice - purchasePrice) / purchasePrice) * 100)
  return { profitPercent, profitAmount, isLoss: profitAmount < 0 }
}

export interface DiscountResult {
  finalPrice: number
  savedAmount: number
}

/** Mode 3 — original price + discount % → final price and amount saved. */
export function calcDiscount(originalPrice: number, discountPercent: number): DiscountResult {
  const savedAmount = round2((originalPrice * discountPercent) / 100)
  const finalPrice = round2(originalPrice - (originalPrice * discountPercent) / 100)
  return { finalPrice, savedAmount }
}

export interface FieldRule {
  /** value must be strictly greater than 0 */
  positive?: boolean
  /** value must be ≥ 0 */
  nonNegative?: boolean
  /** value must be within [0, 100] */
  percentRange?: boolean
}

/** Validate a parsed input value against a rule set. Returns null when valid. */
export function validateValue(value: number, rule: FieldRule, rawEmpty: boolean): ValidationError | null {
  if (rawEmpty) return 'required'
  if (!Number.isFinite(value)) return 'invalid'
  if (rule.percentRange && (value < 0 || value > 100)) return 'discountRange'
  if (rule.positive && value <= 0) return 'notPositive'
  if (rule.nonNegative && value < 0) return 'negative'
  if (Math.abs(value) > MAX_VALUE) return 'tooLarge'
  return null
}

/** Per-mode validation rules for [first, second] fields. */
export const MODE_RULES: Record<Mode, [FieldRule, FieldRule]> = {
  profit: [{ positive: true }, { nonNegative: true }],
  sell: [{ positive: true }, { nonNegative: true }],
  discount: [{ positive: true }, { percentRange: true }],
}
