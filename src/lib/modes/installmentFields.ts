import { round2 } from '../calc'
import { INSTALLMENT_COUNTS } from '../installment'
import { parseAmount } from '../numbers'
import type { FieldSpec, ModeState } from './types'

/** Inputs every instalment mode shares: cash price, term, and an optional down payment. */
export const INSTALLMENT_BASE_FIELDS: FieldSpec[] = [
  { key: 'cash', labelKey: 'installment.cashPrice', kind: 'money', rule: { positive: true } },
  {
    key: 'n',
    labelKey: 'installment.count',
    kind: 'chips',
    rule: { positive: true },
    options: INSTALLMENT_COUNTS.map(String),
    allowCustom: true,
    defaultValue: '6',
  },
  {
    key: 'down',
    labelKey: 'installment.downPayment',
    kind: 'money',
    // The field's own unit follows whichever way `downMode` is currently set, so a shopkeeper in
    // Percent mode sees a '%' beside the box instead of a bare number that is silently read as one.
    kindWhen: (state) => (state['downMode'] === 'percent' ? 'percent' : 'money'),
    rule: { nonNegative: true },
    optional: true,
  },
  /* Sits under the amount it governs, so "Amount | Percent" reads as a property of the
     down payment rather than as an orphaned choice above it. */
  {
    key: 'downMode',
    labelKey: 'installment.downPayment',
    kind: 'toggle',
    rule: {},
    options: ['amount', 'percent'],
    optionLabelKeys: ['installment.downPaymentAmount', 'installment.downPaymentPercent'],
    defaultValue: 'amount',
    /*
     * Without this, tapping Amount/Percent left the down payment's own digits exactly as typed
     * while quietly changing what they meant — 2,000,000 (an amount) read as 2,000,000% the
     * moment Percent was tapped, and Calculate failed on an error about a down payment larger
     * than the cash price that had nothing to do with what the shopkeeper actually did wrong.
     *
     * Converting keeps the same money amount true across the switch (2,000,000 of a 10,000,000
     * cash price becomes 20%, and back again); with no usable cash price to convert against,
     * clearing is the honest fallback — carrying the raw digits forward under a new unit is
     * exactly the bug this exists to fix, so an unconvertible value must not survive either.
     */
    onToggle: (next, values) => {
      const cash = parseAmount(values['cash'] ?? '')
      const current = parseAmount(values['down'] ?? '')
      if (!Number.isFinite(cash) || cash <= 0 || !Number.isFinite(current)) return { key: 'down', value: '' }
      const converted = next === 'percent' ? (current / cash) * 100 : (current * cash) / 100
      return { key: 'down', value: String(round2(converted)) }
    },
  },
]

/** The reverse check also asks what flat monthly rate the seller charges today. */
export const INSTALLMENT_REVERSE_FIELDS: FieldSpec[] = [
  ...INSTALLMENT_BASE_FIELDS,
  { key: 'flat', labelKey: 'installment.flatMonthlyInput', kind: 'percent', rule: { nonNegative: true } },
]

/** The down payment in money, whichever way the user chose to enter it. */
export function resolveDownPayment(cashPrice: number, values: Record<string, number>, state: ModeState): number {
  const entered = values['down'] ?? 0
  return state['downMode'] === 'percent' ? round2((cashPrice * entered) / 100) : round2(entered)
}
