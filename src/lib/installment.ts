/** Instalment plans: what a "no interest, just 3% a month" offer really costs, in today's money. */

import { round2 } from './calc'

/** Plan lengths Iranian shops actually quote. */
export const INSTALLMENT_COUNTS = [3, 6, 9, 12, 18, 24] as const

/** A = (1 − (1+r)^−n)/r, the present value of 1 unit paid n times. Left unrounded — it is a factor, not money. */
export function annuityFactor(monthlyRate: number, n: number): number {
  if (monthlyRate === 0) return n
  return (1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate
}

export interface InstallmentForward {
  annuityFactor: number
  installment: number
  total: number
  markupPercent: number
  flatMonthlyPercent: number
  financed: number
}

/** Cash price + down payment + honest monthly rate → the instalment a fair lender would charge. */
export function calcInstallmentForward(
  cashPrice: number,
  downPayment: number,
  n: number,
  monthlyRate: number,
): InstallmentForward {
  const financed = cashPrice - downPayment
  const factor = annuityFactor(monthlyRate, n)
  const q = financed / factor
  const total = downPayment + n * q
  // Flat rate is quoted on the financed amount per month, which is why it looks so much smaller than the real one.
  const flat = financed === 0 ? 0 : (n * q - financed) / financed / n
  return {
    annuityFactor: factor,
    installment: round2(q),
    total: round2(total),
    markupPercent: round2(((total - cashPrice) / cashPrice) * 100),
    flatMonthlyPercent: round2(flat * 100),
    financed: round2(financed),
  }
}

export interface InstallmentReverse {
  installment: number
  presentValue: number
  total: number
  realGainPercent: number
  gainAmount: number
}

/** A shop's flat "f% per month" offer → what the plan is worth today at the real monthly rate. */
export function calcInstallmentReverse(
  cashPrice: number,
  downPayment: number,
  n: number,
  flatMonthlyPercent: number,
  monthlyRate: number,
): InstallmentReverse {
  const financed = cashPrice - downPayment
  const q = (financed * (1 + (flatMonthlyPercent / 100) * n)) / n
  const presentValue = downPayment + q * annuityFactor(monthlyRate, n)
  return {
    installment: round2(q),
    presentValue: round2(presentValue),
    total: round2(downPayment + n * q),
    realGainPercent: round2((presentValue / cashPrice - 1) * 100),
    gainAmount: round2(presentValue - cashPrice),
  }
}

export type InstallmentError = 'downPaymentTooHigh' | 'installmentCountInvalid'

/** downPaymentTooHigh when D ≥ P; installmentCountInvalid when n is not a positive integer. */
export function validateInstallment(cashPrice: number, downPayment: number, n: number): InstallmentError | null {
  if (downPayment >= cashPrice) return 'downPaymentTooHigh'
  if (!Number.isInteger(n) || n <= 0) return 'installmentCountInvalid'
  return null
}
