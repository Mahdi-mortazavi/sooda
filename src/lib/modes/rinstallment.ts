import { monthlyRateFromPercent, profitStatus } from '../inflation'
import { calcInstallmentReverse, validateInstallment, type InstallmentReverse } from '../installment'
import { resolveDownPayment } from './installmentFields'
import type { ValidationError } from '../calc'
import { type ModeBehaviour, valueOf } from './types'

interface ReverseResult extends InstallmentReverse {
  count: number
  downPayment: number
  startAt: number
}

/** "Is my current deal profitable?" — judges the flat monthly rate a seller already charges. */
export const reverseInstallmentBehaviour: ModeBehaviour<ReverseResult> = {
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
    const result = calcInstallmentReverse(cash, downPayment, count, valueOf(values, 'flat'), rate)
    return { ...result, count, downPayment, startAt: ctx.now }
  },
  present: (r, _values, ctx) => {
    const pct = ctx.t('fields.percentUnit')
    // The bar is a cash sale: beating it is healthy, matching or missing it is not.
    const status = profitStatus(r.realGainPercent, 0)
    const losing = status === 'losing'
    const label = losing ? ctx.t('installment.realLoss') : ctx.t('installment.realGain')
    return {
      key: ctx.key,
      primaryLabel: label,
      primaryValue: r.realGainPercent,
      primaryUnit: pct,
      secondaryLabel: ctx.t('results.profitAmount'),
      secondaryValue: r.gainAmount,
      isLoss: losing,
      status,
      statusLabel: ctx.t(losing ? 'lens.statusLosing' : 'lens.statusHealthy'),
      extras: [
        { label: ctx.t('installment.monthly'), value: ctx.fmtMoney(r.installment) },
        { label: ctx.t('installment.presentValue'), value: ctx.fmtMoney(r.presentValue) },
      ],
      schedule: { installment: r.installment, count: r.count, downPayment: r.downPayment, total: r.total, startAt: r.startAt },
      copyText: `${label}: ${ctx.fmtNumber(r.realGainPercent)}${pct} — ${ctx.fmtMoney(r.gainAmount)}`,
    }
  },
  snapshot: (r, values) => ({
    inputs: [valueOf(values, 'cash'), r.count, r.downPayment, valueOf(values, 'flat')],
    results: [r.realGainPercent, r.gainAmount, r.installment, r.presentValue],
  }),
}
