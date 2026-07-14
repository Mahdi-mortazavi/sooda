import type { Mode } from './calc'

/** i18n keys for each mode's [first, second] input fields. */
export const MODE_FIELD_KEYS: Record<Mode, [string, string]> = {
  profit: ['fields.purchasePrice', 'fields.desiredProfitPercent'],
  sell: ['fields.purchasePrice', 'fields.sellingPrice'],
  discount: ['fields.originalPrice', 'fields.discountPercent'],
}

/** Whether the [first, second] input of each mode is a percentage. */
export const MODE_FIELD_IS_PERCENT: Record<Mode, [boolean, boolean]> = {
  profit: [false, true],
  sell: [false, false],
  discount: [false, true],
}

/** Whether the [primary, secondary] result of each mode is a percentage. */
export const MODE_RESULT_IS_PERCENT: Record<Mode, [boolean, boolean]> = {
  profit: [false, false],
  sell: [true, false],
  discount: [false, false],
}
