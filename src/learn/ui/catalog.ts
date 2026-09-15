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
 * A goal names the lessons that answer it, best first. The recommended path is those lists read
 * in the order the user picked their goals, de-duplicated — so someone who said "pricing" and
 * then "inflation" is shown pricing's answer first and never the same lesson twice.
 */
const GOAL_PATHS: Record<GoalId, readonly LessonId[]> = {
  pricing: ['profit', 'discount', 'everyday'],
  inflation: ['realProfit', 'smartRates', 'profit'],
  installments: ['installments', 'profit'],
  products: ['products', 'smartRates', 'realProfit'],
  explore: ['everyday', 'profit', 'safety'],
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

/** The i18n keys a lesson's card is drawn from; `copy` owns the strings behind them. */
export function lessonTitleKey(id: LessonId): string {
  return `learn.lessons.${id}.title`
}

export function lessonBodyKey(id: LessonId): string {
  return `learn.lessons.${id}.body`
}
