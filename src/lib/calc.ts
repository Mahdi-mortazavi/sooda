/** Pure calculation engine for Sooda's three modes. All money results rounded to 2 decimals. */

export type Mode = 'profit' | 'sell' | 'discount' | 'rdiscount' | 'installment' | 'rinstallment'

/** The four two-field modes that shipped before v1.3; they are the ones MODE_RULES covers. */
export type LegacyMode = 'profit' | 'sell' | 'discount' | 'rdiscount'

export const MODES: readonly Mode[] = [
  'profit',
  'sell',
  'discount',
  'rdiscount',
  'installment',
  'rinstallment',
] as const

/** Maximum sensible magnitude for any money/percent input. */
export const MAX_VALUE = 999_999_999_999

export type ValidationError =
  | 'required'
  | 'invalid'
  | 'negative'
  | 'notPositive'
  | 'tooLarge'
  | 'discountRange'
  | 'reverseDiscountRange'
  /* Cross-field rules a single FieldRule cannot express; raised by a mode's own validate(). */
  | 'downPaymentTooHigh'
  | 'installmentCountInvalid'

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

export interface ReverseDiscountResult {
  originalPrice: number
  savedAmount: number
}

/** Mode 4 — final (discounted) price + discount % → original price and amount saved. */
export function calcReverseDiscount(finalPrice: number, discountPercent: number): ReverseDiscountResult {
  const originalPrice = round2(finalPrice / (1 - discountPercent / 100))
  const savedAmount = round2(originalPrice - finalPrice)
  return { originalPrice, savedAmount }
}

export interface FieldRule {
  /** value must be strictly greater than 0 */
  positive?: boolean
  /** value must be ≥ 0 */
  nonNegative?: boolean
  /** value must be within [0, 100] */
  percentRange?: boolean
  /** value must be within [0, 100) — reverse discount is undefined at exactly 100% */
  percentBelow100?: boolean
}

/** Validate a parsed input value against a rule set. Returns null when valid. */
export function validateValue(value: number, rule: FieldRule, rawEmpty: boolean): ValidationError | null {
  if (rawEmpty) return 'required'
  if (!Number.isFinite(value)) return 'invalid'
  if (rule.percentRange && (value < 0 || value > 100)) return 'discountRange'
  if (rule.percentBelow100 && (value < 0 || value >= 100)) return 'reverseDiscountRange'
  if (rule.positive && value <= 0) return 'notPositive'
  if (rule.nonNegative && value < 0) return 'negative'
  if (Math.abs(value) > MAX_VALUE) return 'tooLarge'
  return null
}

/** Per-mode validation rules for [first, second] fields. Modes with more fields
 *  declare their own rules in their ModeSpec instead. */
export const MODE_RULES: Record<LegacyMode, [FieldRule, FieldRule]> = {
  profit: [{ positive: true }, { nonNegative: true }],
  sell: [{ positive: true }, { nonNegative: true }],
  discount: [{ positive: true }, { percentRange: true }],
  rdiscount: [{ positive: true }, { percentBelow100: true }],
}
