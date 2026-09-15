/**
 * Action names the lessons need that `TOUR_ACTIONS` does not have yet.
 *
 * Declared here, once, rather than spelled at a call site: `coach` owns that list, and a lesson
 * that invents `rate-why` in one predicate and `why-rate` in another would leave `ui` emitting
 * the wrong one with nothing to catch it. Every name below is requested of `coach`; until it is
 * appended to `TOUR_ACTIONS`, `missingTourActions()` says so and the lessons suite reports it.
 */

import { TOUR_ACTIONS } from '../coach/events'

/** Four buttons no existing action covers. The rate card owns three of them. */
export const REQUESTED_TOUR_ACTIONS = {
  /** «چرا این عدد؟» — the rate card's explanation disclosure. */
  rateWhy: 'rate-why',
  /** The manual monthly rate was committed on the rate card. */
  rateManual: 'rate-manual',
  /** «برگرد به خودکار» — the manual rate was dropped again. */
  rateAuto: 'rate-auto',
  /** The automatic-updates switch in settings was flipped. */
  toggleAutoRates: 'toggle-auto-rates',
} as const

export type RequestedTourAction = (typeof REQUESTED_TOUR_ACTIONS)[keyof typeof REQUESTED_TOUR_ACTIONS]

/** Which of the four are still not in `TOUR_ACTIONS`. Empty once `coach` has appended them. */
export function missingTourActions(): string[] {
  const known: readonly string[] = TOUR_ACTIONS
  return Object.values(REQUESTED_TOUR_ACTIONS).filter((name) => !known.includes(name))
}
