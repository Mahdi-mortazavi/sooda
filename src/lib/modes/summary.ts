import { at } from '../numbers'
import type { ModeId } from './types'

/** Formatters a summary line needs: plain numbers, money with the row's unit, and the percent sign. */
export interface SummaryFormat {
  number: (value: number) => string
  money: (value: number) => string
  percent: string
}

export interface EntrySummary {
  text: string
  isLoss: boolean
}

/**
 * One-line recap of a stored calculation, shared by the history and basket lists so the
 * two can never drift. Rendered dir="ltr" by the callers, so the arrow always points forward.
 */
export function entrySummary(mode: ModeId, inputs: number[], results: number[], fmt: SummaryFormat): EntrySummary {
  const n = fmt.number
  const m = fmt.money
  const pct = fmt.percent
  switch (mode) {
    case 'profit':
      return { text: `${n(at(inputs, 0))} + ${n(at(inputs, 1))}${pct} → ${m(at(results, 0))}`, isLoss: false }
    case 'sell':
      return {
        text: `${n(at(inputs, 0))} → ${n(at(inputs, 1))} = ${n(at(results, 0))}${pct}`,
        isLoss: at(results, 1) < 0,
      }
    case 'discount':
      return { text: `${n(at(inputs, 0))} − ${n(at(inputs, 1))}${pct} → ${m(at(results, 0))}`, isLoss: false }
    case 'rdiscount':
      return { text: `${n(at(inputs, 0))} @ ${n(at(inputs, 1))}${pct} → ${m(at(results, 0))}`, isLoss: false }
    case 'installment':
      return { text: `${n(at(inputs, 0))} ÷ ${n(at(inputs, 1))} → ${m(at(results, 0))}`, isLoss: false }
    case 'rinstallment':
      return {
        text: `${n(at(inputs, 0))} ÷ ${n(at(inputs, 1))} @ ${n(at(inputs, 3))}${pct} → ${n(at(results, 0))}${pct}`,
        isLoss: at(results, 0) <= 0,
      }
  }
}
