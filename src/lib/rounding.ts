import { round2 } from './calc'

/** Selling-price rounding steps, in the app's smallest currency unit. 0 = off. */
export const ROUNDING_STEPS = [0, 1000, 5000, 10000, 50000] as const
export type RoundingStep = (typeof ROUNDING_STEPS)[number]

export const ROUNDING_STORAGE_KEY = 'sooda:rounding'

export function isRoundingStep(value: unknown): value is RoundingStep {
  return typeof value === 'number' && (ROUNDING_STEPS as readonly number[]).includes(value)
}

export function readRoundingStep(): RoundingStep {
  try {
    const stored = Number(localStorage.getItem(ROUNDING_STORAGE_KEY))
    if (isRoundingStep(stored)) return stored
  } catch {
    // storage unavailable
  }
  return 0
}

export function storeRoundingStep(step: RoundingStep): void {
  try {
    localStorage.setItem(ROUNDING_STORAGE_KEY, String(step))
  } catch {
    // best-effort persistence
  }
}

/**
 * Round a selling price UP to the next multiple of `step`, so margin is never lost.
 * `step === 0` leaves the value alone (still normalized to 2 decimals).
 * Values that already sit exactly on a step are unchanged. Non-finite input passes through.
 */
export function roundUpTo(value: number, step: RoundingStep): number {
  if (!Number.isFinite(value) || step === 0) return round2(value)
  const scaled = value / step
  // Guard the float artefact that makes e.g. 15000/5000 read as 3.0000000000000004.
  const ceiled = Math.ceil(scaled - 1e-9)
  return round2(ceiled * step)
}

/** True when rounding actually moved the price (used to show the exact value on a second line). */
export function isRounded(value: number, step: RoundingStep): boolean {
  return step !== 0 && roundUpTo(value, step) !== round2(value)
}
