import { calcReverseDiscount, type ReverseDiscountResult } from '../calc'
import { type ModeSpec, valueOf } from './types'

/** Final (discounted) price + discount % → the original price and amount saved. */
export const reverseDiscountMode: ModeSpec<ReverseDiscountResult> = {
  id: 'rdiscount',
  segment: 'discount',
  fields: [
    { key: 'final', labelKey: 'fields.finalPrice', kind: 'money', rule: { positive: true } },
    { key: 'off', labelKey: 'fields.discountPercent', kind: 'percent', rule: { percentBelow100: true } },
  ],
  compute: (values) => calcReverseDiscount(valueOf(values, 'final'), valueOf(values, 'off')),
  present: (r, _values, ctx) => ({
    key: ctx.key,
    primaryLabel: ctx.t('results.originalPrice'),
    primaryValue: r.originalPrice,
    secondaryLabel: ctx.t('results.savedAmount'),
    secondaryValue: r.savedAmount,
    isLoss: false,
    copyText:
      `${ctx.t('results.originalPrice')}: ${ctx.fmtMoney(r.originalPrice)}` +
      ` — ${ctx.t('results.savedAmount')}: ${ctx.fmtMoney(r.savedAmount)}`,
  }),
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'final'), valueOf(values, 'off')],
    results: [r.originalPrice, r.savedAmount],
  }),
}
