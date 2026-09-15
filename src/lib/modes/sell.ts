import { calcFromSellingPrice, type SellingPriceResult } from '../calc'
import { type ModeSpec, valueOf } from './types'

/** Purchase price + selling price → profit % and profit amount (negative = loss). */
export const sellMode: ModeSpec<SellingPriceResult> = {
  id: 'sell',
  segment: 'sell',
  fields: [
    { key: 'cost', labelKey: 'fields.purchasePrice', kind: 'money', rule: { positive: true } },
    { key: 'price', labelKey: 'fields.sellingPrice', kind: 'money', rule: { nonNegative: true } },
  ],
  compute: (values) => calcFromSellingPrice(valueOf(values, 'cost'), valueOf(values, 'price')),
  present: (r, _values, ctx) => {
    const pct = ctx.t('fields.percentUnit')
    const pctLabel = r.isLoss ? ctx.t('results.lossPercent') : ctx.t('results.profitPercent')
    const amtLabel = r.isLoss ? ctx.t('results.lossAmount') : ctx.t('results.profitAmount')
    return {
      key: ctx.key,
      primaryLabel: pctLabel,
      primaryValue: r.profitPercent,
      primaryUnit: pct,
      secondaryLabel: amtLabel,
      secondaryValue: r.profitAmount,
      isLoss: r.isLoss,
      notice: r.isLoss
        ? ctx.t('results.lossNotice')
        : r.profitAmount === 0
          ? ctx.t('results.breakEven')
          : undefined,
      copyText:
        `${pctLabel}: ${ctx.fmtNumber(r.profitPercent)}${pct}` +
        ` — ${amtLabel}: ${ctx.fmtMoney(r.profitAmount)}`,
    }
  },
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'cost'), valueOf(values, 'price')],
    results: [r.profitPercent, r.profitAmount],
  }),
}
