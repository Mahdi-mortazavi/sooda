import { round2 } from '../calc'
import {
  LENS_MONTHS,
  monthlyRateFromPercent,
  profitStatus,
  realProfitPercent,
  replacementCost,
  type ProfitStatus,
} from '../inflation'
import type { CalcContext, FieldSpec, LensBlock, ModeState, PresentContext } from './types'

/**
 * The real-profit lens: the same three fields on every mode that has one.
 * `months` of 0 means "now", which leaves the mode behaving exactly as it did in v1.2.0.
 */
export const LENS_FIELDS: FieldSpec[] = [
  {
    key: 'months',
    labelKey: 'lens.title',
    kind: 'chips',
    group: 'lens',
    rule: { nonNegative: true },
    options: LENS_MONTHS.map(String),
    optionLabelKeys: ['lens.now', 'lens.m1', 'lens.m3', 'lens.m6', 'lens.m12'],
    defaultValue: '0',
  },
  {
    key: 'src',
    labelKey: 'lens.title',
    kind: 'toggle',
    group: 'lens',
    rule: {},
    options: ['inflation', 'known'],
    optionLabelKeys: ['lens.sourceInflation', 'lens.sourceKnown'],
    defaultValue: 'inflation',
    visibleWhen: (state) => lensMonths(state) > 0,
  },
  {
    key: 'replacement',
    labelKey: 'lens.replacementField',
    kind: 'money',
    group: 'lens',
    // Not optional: `resolveReplacement` below only trusts a *supplied* figure (`supplied > 0`),
    // so an optional field left blank — silently resolved to 0 by the generic validator, with no
    // error shown — used to fall straight through to the inflation estimate, as if the shopkeeper
    // had never chosen "I know today's price" at all. Once this field is on screen the choice was
    // made and a value is required, exactly like any other field a mode cannot compute without.
    rule: { positive: true },
    visibleWhen: (state) => lensMonths(state) > 0 && state['src'] === 'known',
  },
]

export function lensMonths(state: ModeState): number {
  const parsed = Number(state['months'] ?? '0')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** What restocking the same goods will cost: the user's own figure when they have one. */
export function resolveReplacement(cost: number, months: number, values: Record<string, number>, ctx: CalcContext): number {
  if (months <= 0) return round2(cost)
  const supplied = values['replacement'] ?? 0
  if (ctx.state['src'] === 'known' && supplied > 0) return round2(supplied)
  return replacementCost(cost, monthlyRateFromPercent(ctx.monthlyInflationPercent), months)
}

export interface LensFigures {
  months: number
  replacement: number
  realPercent: number
  status: ProfitStatus
}

/** Real profit of `price` against the restock cost, plus its health against the target. */
export function lensFigures(
  cost: number,
  price: number,
  targetPercent: number,
  values: Record<string, number>,
  ctx: CalcContext,
): LensFigures {
  const months = lensMonths(ctx.state)
  const replacement = resolveReplacement(cost, months, values, ctx)
  const realPercent = replacement > 0 ? realProfitPercent(price, replacement) : 0
  return { months, replacement, realPercent, status: profitStatus(realPercent, targetPercent) }
}

/** Builds the card's real-profit block. Returns undefined when the lens is off. */
export function lensBlock(figures: LensFigures, nominalPercent: number, ctx: PresentContext): LensBlock | undefined {
  if (figures.months <= 0) return undefined
  return {
    months: figures.months,
    nominalPercent,
    realPercent: figures.realPercent,
    status: figures.status,
    replacement: figures.replacement,
    explainer: ctx.t('lens.explainer', {
      months: ctx.fmtNumber(figures.months),
      amount: ctx.fmtMoney(figures.replacement),
    }),
    notice: figures.status === 'losing' ? ctx.t('lens.losingNotice') : undefined,
  }
}
