import { round2 } from '../calc'
import { INSTALLMENT_COUNTS } from '../installment'
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
  { key: 'down', labelKey: 'installment.downPayment', kind: 'money', rule: { nonNegative: true }, optional: true },
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
