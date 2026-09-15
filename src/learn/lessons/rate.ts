/**
 * The tutorial rate, pinned.
 *
 * `docs/v1.5-plan.md`: lessons assume 3%/month whatever `rates.json` says, so a challenge answer
 * cannot change when a maintainer updates a CPI figure. Rounding is pinned for the same reason —
 * the suggested price a lesson shows is rounded, and a shopkeeper who has rounding switched off
 * would otherwise be asked a question whose answer is a different number on their own screen.
 *
 * `ui` feeds both of these to the calculator while practice is running, in place of the user's
 * own settings, and must not write either one to the user's storage.
 */

import type { RoundingStep } from '../../lib/rounding'

/** Monthly, not annual. The same basis the engine uses everywhere since v1.5 §0. */
export const TUTORIAL_MONTHLY_PERCENT = 3

/** 1,000 toman — what the demo shop's own prices were built on, so nothing on screen disagrees. */
export const TUTORIAL_ROUNDING_STEP: RoundingStep = 1000

/** «در این تمرین فرض می‌کنیم قیمت‌ها ماهی ۳٪ گران می‌شوند.» — shown by every lesson with `showsRate`. */
export const TUTORIAL_RATE_NOTE_KEY = 'learn.rateNote'
