/** The Learning Centre's own vocabulary. Lazy-chunk only — the entry chunk never needs a lesson id. */

/** The eight lessons, in the order the centre lists them when nothing is recommended. */
export const LESSON_IDS = [
  'profit',
  'discount',
  'realProfit',
  'installments',
  'products',
  'smartRates',
  'everyday',
  'safety',
] as const

export type LessonId = (typeof LESSON_IDS)[number]

export function isLessonId(value: string): value is LessonId {
  return (LESSON_IDS as readonly string[]).includes(value)
}

/**
 * What the shopkeeper said they came for, asked once during onboarding.
 *
 * Exactly the four chips the brief froze. `discounts` is the only one that speaks to them as a
 * buyer rather than a seller, which is why it is not folded into `pricing`.
 */
export const GOAL_IDS = ['pricing', 'installments', 'products', 'discounts'] as const

export type GoalId = (typeof GOAL_IDS)[number]

export function isGoalId(value: string): value is GoalId {
  return (GOAL_IDS as readonly string[]).includes(value)
}

/**
 * `done` is "walked through it"; `passed` is "answered its challenge correctly". Both count as
 * finished for the ring, but only `passed` counts towards «استاد سودا» — the badge has to mean
 * something more than having scrolled to the end.
 */
export type LessonStatus = 'new' | 'progress' | 'done' | 'passed'

export interface LessonProgress {
  status: LessonStatus
  /** Where to resume. Nothing in the tutorial is ever lost by leaving it. */
  step: number
  passedAt?: number
}

/** The shape frozen in `docs/v1.5-plan.md` for `localStorage['sooda.learn.v1']`. */
export interface LearnProgress {
  onboardingDone: boolean
  goals: GoalId[]
  lessons: Record<LessonId, LessonProgress>
  tipsSeen: string[]
  tipsEnabled: boolean
}
