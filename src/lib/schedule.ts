import { round2 } from './calc'
import { addMonths } from './dates'

export interface ScheduleRow {
  index: number
  dueAt: number
  amount: number
}

/** n due dates, the first a whole Persian month after `startAt`. */
export function buildSchedule(installment: number, n: number, startAt: number): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (let i = 1; i <= n; i++) {
    rows.push({ index: i, dueAt: addMonths(startAt, i), amount: round2(installment) })
  }
  return rows
}
