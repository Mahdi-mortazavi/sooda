/**
 * The eight lessons.
 *
 * Declarative all the way down: a lesson is data, the coach is the only thing that runs. Loaded
 * with `await import('../lessons')` — a static import would put the whole tutorial in the entry
 * chunk, which the plan's first-paint gate does not have room for.
 */

import { discountLesson } from './discount'
import { everydayLesson } from './everyday'
import { installmentsLesson } from './installments'
import { productsLesson } from './products'
import { profitLesson } from './profit'
import { realProfitLesson } from './realProfit'
import { safetyLesson } from './safety'
import { smartRatesLesson } from './smartRates'
import type { Lesson, LessonId } from './types'

/**
 * In the order the learning centre offers them: what a price is, what it is really worth, then
 * the shop around it. Each one stands alone — nothing here assumes the previous was taken — but
 * they share «آقا رضا»'s story, so taken in order they read as one.
 */
export const LESSONS: Lesson[] = [
  profitLesson,
  discountLesson,
  realProfitLesson,
  installmentsLesson,
  productsLesson,
  smartRatesLesson,
  everydayLesson,
  safetyLesson,
]

export const LESSON_IDS: LessonId[] = LESSONS.map((lesson) => lesson.id)

export function getLesson(id: LessonId): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

/**
 * The seam `src/learn/ui/lessonSource.ts` documents, filled in.
 *
 * It expects `import('../lessons').then((m) => m.loadLesson(id))` to hand back a definition with
 * an id and steps, so that is what this returns — the whole `Lesson`, which has both, plus the
 * challenges the centre needs to turn «done» into «passed».
 *
 * `now` is deliberately not set. `enterPractice({ now })` would date the demo shop from a fixed
 * instant, and every «۱ ماه پیش» on the products tab is measured against the real clock — pin it
 * and the shop reads as years stale the following spring. Nothing a challenge asks depends on
 * when it is taken; `expected.test.ts` proves that by recomputing every answer a year on.
 */
export function loadLesson(id: LessonId): Lesson | null {
  return getLesson(id) ?? null
}

/**
 * Mission 1, kept out of `LESSONS` and out of `LessonId`.
 *
 * Onboarding runs it; the Learning Centre never lists it, and the progress store has no row for
 * it. Exported here so `ui` reaches the tutorial through one module either way.
 */
export { MISSION, loadMission } from './mission'

export { REQUESTED_TOUR_ACTIONS, missingTourActions } from './actions'
export { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
export { TUTORIAL_MONTHLY_PERCENT, TUTORIAL_RATE_NOTE_KEY, TUTORIAL_ROUNDING_STEP } from './rate'
export { isTourTarget, TOUR_TARGET_NAMES, TOUR_TARGETS, type TourTargetName } from './targets'
export type {
  Challenge,
  ChallengeOption,
  ChoiceChallenge,
  Lesson,
  LessonDemo,
  LessonDemoAction,
  LessonExpected,
  LessonId,
  LessonInputs,
  LessonStepSpec,
  Mission,
  NumberChallenge,
  TaskChallenge,
} from './types'
