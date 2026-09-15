/**
 * Every `data-tour` name a lesson points at, in one place.
 *
 * `ui` owns the attributes themselves; this is the checklist it works from, and the list a test
 * asserts against the rendered tree. A lesson may only name a target that appears here, which is
 * what keeps «the chip row» from being called `count-chips` in one lesson and `field-n` in the next.
 *
 * Three of the names are generated rather than one-off, so `ui` can add them in one place each:
 *
 *   `field-<key>`        on the wrapper of a mode field, for every `FieldSpec.key`  (ModeFields, LensRow)
 *   `chip-<key>-<value>` on one option button inside a chips or toggle field         (ChipRow)
 *   `seg-<value>`        on one option button inside a SegmentedControl              (SegmentedControl)
 *
 * Only the generated names a lesson actually uses are listed below; adding the attribute for every
 * key and option is cheaper than adding it for some.
 */

export const TOUR_TARGETS = {
  /* ── the calculator ─────────────────────────────────────────────────── */
  'calc-panel': 'The input card holding the current mode’s fields — the whole card, not one field.',
  'field-cost': 'The purchase-price input (profit and sell modes).',
  'field-margin': 'The desired-profit-% input (profit mode).',
  'field-price': 'The selling-price input (sell mode); the original-price input (discount mode).',
  'field-final': 'The already-discounted-price input (reverse discount).',
  'field-off': 'The discount-% input (both discount directions).',
  'field-cash': 'The cash-price input (both instalment modes).',
  'field-down': 'The down-payment input (both instalment modes).',
  'field-flat': 'The seller’s flat monthly-% input (reverse instalment check).',
  'field-n': 'The instalment-count chip row (both instalment modes).',
  'field-months': 'The lens month chip row — «now / 1 / 3 / 6 / 12».',
  'field-replacement': 'The «I already know the new cost» money input in the lens row.',
  'chip-months-3': 'The «3 months» option inside the lens month chips.',
  'chip-n-6': 'The «6» option inside the instalment count chips.',
  'chip-src-known': 'The «I know the price» option of the lens source toggle.',
  'lens-row': 'The whole real-profit lens row: month chips, source toggle and known-cost field.',
  'btn-calculate': 'The Calculate button.',
  'seg-sell': 'The «Sell price» option of the top segmented control.',
  'seg-installments': 'The «Instalments» option of the cash/instalments sub-control.',
  'seg-rdiscount': 'The reverse option of the discount-direction sub-control.',
  'seg-rinstallment': 'The «reverse check» option of the instalment-direction sub-control.',

  /* ── the result card ────────────────────────────────────────────────── */
  'result-card': 'The whole result card, including its copy / share / basket buttons.',
  'btn-copy': 'The copy button on the result card.',
  'btn-share': 'The share-link button on the result card.',
  'btn-add-basket': 'The add-to-basket button on the result card.',
  'btn-save-product': 'The «save to my products» button under the result.',
  'btn-schedule': 'The «customer schedule» button under an instalment result.',

  /* ── the shell ──────────────────────────────────────────────────────── */
  'btn-basket-open': 'The basket button in the header.',
  'btn-settings': 'The settings (gear) button in the header.',
  'btn-export-csv': 'The «export CSV» button in the history sheet.',

  /* ── saving a product ───────────────────────────────────────────────── */
  'save-product-panel': 'The body of the save-product sheet: name field and save button.',
  'field-product-name': 'The product-name input in the save-product sheet.',
  'btn-save-confirm': 'The save button in the save-product sheet.',

  /* ── the products tab ───────────────────────────────────────────────── */
  'product-row': 'The first row of the products list — with the default sort, the riskiest product.',
  'product-new-cost': 'The «new purchase price» section of the product detail sheet.',
  'btn-new-cost-open': 'The disclosure that opens the «new purchase price» section.',
  'field-new-cost': 'The new-purchase-price input in that section.',
  'btn-new-cost-apply': 'The «use this price» button in that section.',
  'checkin-card': 'The price check-in prompt card at the top of the products tab.',

  /* ── the rate card, inside the product detail sheet ─────────────────── */
  'rate-card': 'The price-growth rate card in the product detail sheet.',
  'btn-rate-why': 'The «why this number?» button on the rate card.',
  'btn-rate-manual': 'The «set it myself» button on the rate card.',
  'field-manual-rate': 'The manual monthly-% input on the rate card.',
  'btn-manual-commit': 'The button that commits the manual rate.',
  'btn-rate-auto': 'The «back to automatic» button on the rate card.',

  /* ── bulk reprice ───────────────────────────────────────────────────── */
  'bulk-panel': 'The body of the bulk-reprice sheet: operation chips, percent field and preview.',
  'chip-bulk-costup': 'The «the purchase price went up» operation chip in that sheet.',
  'field-bulk-percent': 'The percent input in that sheet.',
  'btn-bulk-apply': 'The apply button in that sheet.',

  /* ── the store profile ──────────────────────────────────────────────── */
  'profile-panel': 'The body of the store-setup sheet: categories, dollar dependency and save.',
  'btn-profile-save': 'The save button in the store-setup sheet.',

  /* ── the price check-in ─────────────────────────────────────────────── */
  'checkin-panel': 'The body of the check-in sheet: the card, the field and the three buttons.',
  'field-checkin-cost': 'The cost input in the check-in sheet.',
  'btn-checkin-record': 'The «record» button in the check-in sheet.',
  'btn-checkin-unchanged': 'The «no change» button in the check-in sheet.',

  /* ── settings ───────────────────────────────────────────────────────── */
  'settings-install': 'The «add to home screen» row in settings.',
  'settings-rates-auto': 'The automatic-updates row in settings, including its switch.',
  'btn-rates-auto': 'The switch itself in that row.',
  'settings-backup': 'The backup section in settings.',
  'btn-backup-export': 'The «save a backup file» button in that section.',
} as const satisfies Record<string, string>

/** Every name above, as a union — a lesson cannot point at a target that is not on the list. */
export type TourTargetName = keyof typeof TOUR_TARGETS

/** The names alone, for a test that walks the rendered tree. */
export const TOUR_TARGET_NAMES = Object.keys(TOUR_TARGETS) as TourTargetName[]

export function isTourTarget(name: string): name is TourTargetName {
  return Object.prototype.hasOwnProperty.call(TOUR_TARGETS, name)
}
