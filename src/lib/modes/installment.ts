import { monthlyRateFromPercent } from '../inflation'
import { calcInstallmentForward, validateInstallment, type InstallmentForward } from '../installment'
import { resolveDownPayment } from './installmentFields'
import type { ValidationError } from '../calc'
import { type ModeBehaviour, valueOf } from './types'

interface ForwardResult extends InstallmentForward {
  count: number
  downPayment: number
  startAt: number
}

/** "How much should I add?" — the instalment that leaves the seller no worse off than a cash sale. */
export const installmentBehaviour: ModeBehaviour<ForwardResult> = {
  validate: (values, state): Record<string, ValidationError> | null => {
    const cash = valueOf(values, 'cash')
    const count = valueOf(values, 'n')
    const error = validateInstallment(cash, resolveDownPayment(cash, values, state), count)
    if (!error) return null
    return error === 'downPaymentTooHigh' ? { down: error } : { n: error }
  },
  compute: (values, ctx) => {
    const cash = valueOf(values, 'cash')
    const count = valueOf(values, 'n')
    const downPayment = resolveDownPayment(cash, values, ctx.state)
    const rate = monthlyRateFromPercent(ctx.monthlyInflationPercent)
    return { ...calcInstallmentForward(cash, downPayment, count, rate), count, downPayment, startAt: ctx.now }
  },
  present: (r, _values, ctx) => {
    const pct = ctx.t('fields.percentUnit')
    return {
      key: ctx.key,
      primaryLabel: ctx.t('installment.monthly'),
      primaryValue: r.installment,
      secondaryLabel: ctx.t('installment.total'),
      secondaryValue: r.total,
      isLoss: false,
      notice: ctx.t('installment.explainer'),
      extras: [
        { label: ctx.t('installment.markup'), value: `${ctx.fmtNumber(r.markupPercent)}${pct}` },
        { label: ctx.t('installment.flatMonthly'), value: `${ctx.fmtNumber(r.flatMonthlyPercent)}${pct}` },
      ],
      schedule: { installment: r.installment, count: r.count, downPayment: r.downPayment, total: r.total, startAt: r.startAt },
      copyText:
        `${ctx.t('installment.monthly')}: ${ctx.fmtMoney(r.installment)}` +
        ` — ${ctx.t('installment.total')}: ${ctx.fmtMoney(r.total)}`,
    }
  },
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'cash'), r.count, r.downPayment],
    results: [r.installment, r.total, r.markupPercent, r.flatMonthlyPercent],
  }),
}
