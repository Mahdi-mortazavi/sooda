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
  NumberChallenge,
  TaskChallenge,
} from './types'
