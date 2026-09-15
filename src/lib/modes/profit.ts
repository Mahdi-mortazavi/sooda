import { calcFromProfitPercent, type ProfitPercentResult } from '../calc'
import { type ModeSpec, valueOf } from './types'

/** Purchase price + desired profit % → selling price and profit amount. */
export const profitMode: ModeSpec<ProfitPercentResult> = {
  id: 'profit',
  segment: 'profit',
  fields: [
    { key: 'cost', labelKey: 'fields.purchasePrice', kind: 'money', rule: { positive: true } },
    { key: 'margin', labelKey: 'fields.desiredProfitPercent', kind: 'percent', rule: { nonNegative: true } },
  ],
  compute: (values) => calcFromProfitPercent(valueOf(values, 'cost'), valueOf(values, 'margin')),
  present: (r, _values, ctx) => ({
    key: ctx.key,
    primaryLabel: ctx.t('results.sellingPrice'),
    primaryValue: r.sellingPrice,
    secondaryLabel: ctx.t('results.profitAmount'),
    secondaryValue: r.profitAmount,
    isLoss: false,
    copyText:
      `${ctx.t('results.sellingPrice')}: ${ctx.fmtMoney(r.sellingPrice)}` +
      ` — ${ctx.t('results.profitAmount')}: ${ctx.fmtMoney(r.profitAmount)}`,
  }),
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'cost'), valueOf(values, 'margin')],
    results: [r.sellingPrice, r.profitAmount],
  }),
}
