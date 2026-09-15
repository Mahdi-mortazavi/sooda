import { calcDiscount, type DiscountResult } from '../calc'
import { type ModeSpec, valueOf } from './types'

/** Original price + discount % → final price and amount saved. */
export const discountMode: ModeSpec<DiscountResult> = {
  id: 'discount',
  segment: 'discount',
  fields: [
    { key: 'price', labelKey: 'fields.originalPrice', kind: 'money', rule: { positive: true } },
    { key: 'off', labelKey: 'fields.discountPercent', kind: 'percent', rule: { percentRange: true } },
  ],
  compute: (values) => calcDiscount(valueOf(values, 'price'), valueOf(values, 'off')),
  present: (r, _values, ctx) => ({
    key: ctx.key,
    primaryLabel: ctx.t('results.finalPrice'),
    primaryValue: r.finalPrice,
    secondaryLabel: ctx.t('results.savedAmount'),
    secondaryValue: r.savedAmount,
    isLoss: false,
    copyText:
      `${ctx.t('results.finalPrice')}: ${ctx.fmtMoney(r.finalPrice)}` +
      ` — ${ctx.t('results.savedAmount')}: ${ctx.fmtMoney(r.savedAmount)}`,
  }),
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'price'), valueOf(values, 'off')],
    results: [r.finalPrice, r.savedAmount],
  }),
}
