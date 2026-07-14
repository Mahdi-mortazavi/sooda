import type { Mode } from './calc'

/** Modes shown in the top segmented control ('rdiscount' lives inside the discount segment). */
export const SEGMENT_MODES = ['profit', 'sell', 'discount'] as const

/** Which segment a mode belongs to (for the sliding indicator and slide direction). */
export function segmentIndexOf(mode: Mode): number {
  return mode === 'rdiscount' ? 2 : SEGMENT_MODES.indexOf(mode as (typeof SEGMENT_MODES)[number])
}

/** i18n keys for each mode's [first, second] input fields. */
export const MODE_FIELD_KEYS: Record<Mode, [string, string]> = {
  profit: ['fields.purchasePrice', 'fields.desiredProfitPercent'],
  sell: ['fields.purchasePrice', 'fields.sellingPrice'],
  discount: ['fields.originalPrice', 'fields.discountPercent'],
  rdiscount: ['fields.finalPrice', 'fields.discountPercent'],
}

/** Whether the second input of each mode is a percentage. */
export const MODE_SECOND_IS_PERCENT: Record<Mode, boolean> = {
  profit: true,
  sell: false,
  discount: true,
  rdiscount: true,
}
