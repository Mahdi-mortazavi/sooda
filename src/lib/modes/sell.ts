import { calcFromSellingPrice, type SellingPriceResult } from '../calc'
import { LENS_FIELDS, lensBlock, lensFigures, type LensFigures } from './lens'
import { type ModeSpec, valueOf } from './types'

interface SellResult extends SellingPriceResult {
  figures: LensFigures
}

/** Purchase price + selling price → profit %, seen through the real-profit lens. */
export const sellMode: ModeSpec<SellResult> = {
  id: 'sell',
  segment: 'sell',
  fields: [
    { key: 'cost', labelKey: 'fields.purchasePrice', kind: 'money', rule: { positive: true } },
    { key: 'price', labelKey: 'fields.sellingPrice', kind: 'money', rule: { nonNegative: true } },
    ...LENS_FIELDS,
  ],
  compute: (values, ctx) => {
    const cost = valueOf(values, 'cost')
    const price = valueOf(values, 'price')
    const base = calcFromSellingPrice(cost, price)
    // Nominal profit is the bar the real figure is judged against.
    return { ...base, figures: lensFigures(cost, price, base.profitPercent, values, ctx) }
  },
  present: (r, _values, ctx) => {
    const pct = ctx.t('fields.percentUnit')

    if (r.figures.months <= 0) {
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
    }

    const losing = r.figures.status === 'losing'
    return {
      key: ctx.key,
      primaryLabel: ctx.t('lens.realProfit'),
      primaryValue: r.figures.realPercent,
      primaryUnit: pct,
      secondaryLabel: ctx.t('lens.replacementCost'),
      secondaryValue: r.figures.replacement,
      isLoss: losing,
      lens: lensBlock(r.figures, r.profitPercent, ctx),
      copyText:
        `${ctx.t('lens.realProfit')}: ${ctx.fmtNumber(r.figures.realPercent)}${pct}` +
        ` — ${ctx.t('lens.replacementCost')}: ${ctx.fmtMoney(r.figures.replacement)}`,
    }
  },
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'cost'), valueOf(values, 'price'), r.figures.months, r.figures.replacement],
    results: [r.profitPercent, r.profitAmount, r.figures.realPercent],
  }),
}
