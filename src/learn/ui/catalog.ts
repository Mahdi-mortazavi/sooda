/**
 * What the Learning Centre knows about the eight lessons without loading any of them.
 *
 * Deliberately separate from `src/learn/lessons/**`: the centre has to draw a card, a duration and
 * a status for every lesson before the shopkeeper has chosen one, and pulling eight lesson scripts
 * in to render a list would make opening the centre cost as much as taking every lesson.
 */

import type { GoalId, LessonId } from './types'
import { LESSON_IDS } from './types'

export interface LessonMeta {
  id: LessonId
  /** Roughly how long the lesson takes. The plan caps every lesson at 90 seconds. */
  seconds: number
}

/* Ordered as a newcomer should meet them: what profit is, then what eats it, then the tools. */
export const LESSONS: readonly LessonMeta[] = [
  { id: 'profit', seconds: 70 },
  { id: 'discount', seconds: 55 },
  { id: 'realProfit', seconds: 70 },
  { id: 'installments', seconds: 85 },
  { id: 'products', seconds: 85 },
  { id: 'smartRates', seconds: 80 },
  { id: 'everyday', seconds: 90 },
  { id: 'safety', seconds: 50 },
]

/**
 * What each answer to "what did you come here for?" is worth learning first.
 *
 * A goal names the lessons that answer it, best first. The recommended path reads those lists in
 * turn and de-duplicates, so no lesson appears twice.
 *
 * The goals themselves are read in the order they are declared here, not the order they were
 * tapped: `setGoals` re-sorts through `GOAL_IDS` on the way in, so the path a shopkeeper gets is
 * the same whichever order they picked their chips — which is the property worth having, since
 * tap order carries no meaning they intended.
 */
const GOAL_PATHS: Record<GoalId, readonly LessonId[]> = {
  pricing: ['profit', 'realProfit', 'everyday'],
  installments: ['installments', 'profit'],
  products: ['products', 'smartRates', 'realProfit'],
  discounts: ['discount', 'everyday'],
}

/**
 * The «پیشنهاد برای شما» path: the goals' lessons first, then everything else in catalogue order.
 *
 * Every lesson always appears, because a shopkeeper who answered "pricing" has not opted out of
 * learning about instalments — they have only said what to put in front of them first.
 */
export function recommendedPath(goals: readonly GoalId[]): LessonId[] {
  const seen = new Set<LessonId>()
  const out: LessonId[] = []
  for (const goal of goals) {
    for (const id of GOAL_PATHS[goal]) {
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
  }
  for (const id of LESSON_IDS) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * The rest of the centre's content, as ids.
 *
 * They live beside the lesson list for one reason: a test walks these and asserts that every key
 * built from them resolves in both bundles. Enumerated a second time in the test, that guard
 * would pass while the screen showed a raw key — which is exactly what a mutation check caught.
 */

/** The brief's eight questions, in reading order: concept, numbers, privacy, practicalities. */
export const FAQ_IDS = ['realProfit', 'rate', 'inflation', 'data', 'stop', 'offline', 'phone', 'source'] as const

/** The three first-run cards. The ids are copy's; the drawings follow the sentence, not the id. */
export const INTRO_CARD_IDS = ['price', 'rise', 'practice'] as const

/** Every complex feature that earns a single one-line hint the first time it is used. */
export const TIP_IDS = ['lens', 'installments', 'bulk', 'rate'] as const

/** The i18n keys a lesson's card is drawn from; `copy` owns the strings behind them. */
export function lessonTitleKey(id: LessonId): string {
  return `learn.lessons.${id}.title`
}

export function lessonBodyKey(id: LessonId): string {
  return `learn.lessons.${id}.body`
}
