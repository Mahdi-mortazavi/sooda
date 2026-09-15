import { calcFromProfitPercent, round2 } from '../calc'
import { suggestedPrice } from '../inflation'
import { roundUpTo } from '../rounding'
import { LENS_FIELDS, lensBlock, lensFigures, lensMonths, type LensFigures } from './lens'
import { type ModeSpec, valueOf } from './types'

interface ProfitResult {
  months: number
  /** Plain cost-plus-margin price, before the lens and before rounding. */
  naivePrice: number
  /** What we recommend charging, after the lens and after rounding. */
  price: number
  exactPrice: number
  profitAmount: number
  /** How much more than the naive price the lens says to charge. */
  gap: number
  figures: LensFigures
}

/** Purchase price + desired profit % → selling price, seen through the real-profit lens. */
export const profitMode: ModeSpec<ProfitResult> = {
  id: 'profit',
  segment: 'profit',
  fields: [
    { key: 'cost', labelKey: 'fields.purchasePrice', kind: 'money', rule: { positive: true } },
    { key: 'margin', labelKey: 'fields.desiredProfitPercent', kind: 'percent', rule: { nonNegative: true } },
    ...LENS_FIELDS,
  ],
  compute: (values, ctx) => {
    const cost = valueOf(values, 'cost')
    const margin = valueOf(values, 'margin')
    const months = lensMonths(ctx.state)
    const naive = calcFromProfitPercent(cost, margin)
    // The lens judges the price the user would otherwise have charged.
    const figures = lensFigures(cost, naive.sellingPrice, margin, values, ctx)
    const exactPrice = months > 0 ? suggestedPrice(figures.replacement, margin) : naive.sellingPrice
    const price = roundUpTo(exactPrice, ctx.roundingStep)
    return {
      months,
      naivePrice: naive.sellingPrice,
      price,
      exactPrice,
      profitAmount: round2(price - cost),
      gap: round2(price - naive.sellingPrice),
      figures,
    }
  },
  present: (r, values, ctx) => {
    const cost = valueOf(values, 'cost')
    const margin = valueOf(values, 'margin')
    const exactPrimary = r.price !== round2(r.exactPrice) ? ctx.t('lens.exact', { value: ctx.fmtMoney(r.exactPrice) }) : undefined
    const product = { cost, targetMarginPercent: margin, price: r.price }

    if (r.months <= 0) {
      return {
        key: ctx.key,
        primaryLabel: ctx.t('results.sellingPrice'),
        primaryValue: r.price,
        secondaryLabel: ctx.t('results.profitAmount'),
        secondaryValue: r.profitAmount,
        isLoss: false,
        exactPrimary,
        product,
        copyText:
          `${ctx.t('results.sellingPrice')}: ${ctx.fmtMoney(r.price)}` +
          ` — ${ctx.t('results.profitAmount')}: ${ctx.fmtMoney(r.profitAmount)}`,
      }
    }

    const pct = ctx.t('fields.percentUnit')
    return {
      key: ctx.key,
      primaryLabel: ctx.t('lens.suggestedPrice'),
      primaryValue: r.price,
      secondaryLabel: ctx.t('lens.gapVsNaive'),
      secondaryValue: r.gap,
      isLoss: false,
      exactPrimary,
      product,
      lens: lensBlock(r.figures, margin, ctx),
      copyText:
        `${ctx.t('lens.suggestedPrice')}: ${ctx.fmtMoney(r.price)}` +
        ` — ${ctx.t('lens.realProfit')}: ${ctx.fmtNumber(r.figures.realPercent)}${pct}`,
    }
  },
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'cost'), valueOf(values, 'margin'), r.months, r.figures.replacement],
    results: [r.price, r.profitAmount, r.figures.realPercent],
  }),
}
