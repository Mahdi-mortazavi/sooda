/**
 * The seam between the Learning Centre and `src/learn/lessons/**`.
 *
 * One `import()`, in one place. The centre draws eight cards, a duration and a status before the
 * shopkeeper has chosen anything, and it does that from `catalog.ts` alone — pulling eight lesson
 * scripts in to render a list would make opening the centre cost as much as taking every lesson.
 * Only starting one reaches through here.
 */

import type { LessonStep } from '../coach/types'
import type { Lesson } from '../lessons/types'
import type { LessonId } from './types'

export type LessonDefinition = Lesson

/**
 * Mission 1 — the ≤30-second first run, which is deliberately not one of the eight lessons.
 *
 * It never enters `LESSON_IDS`, never gets a card in the centre and never touches the progress
 * store's lesson map: it is the welcome, not a lesson someone can pass. `lessons` owns the script.
 */
export interface MissionDefinition {
  steps: LessonStep[]
  /** «آقا رضا شالی را ۱۰۰٬۰۰۰ تومان خریده…» — the story card, shown before the first step. */
  storyKey: string
  /** The suggestion chip offered beside a field on the first step. */
  suggestion?: { field: string; value: string; labelKey: string }
}

/**
 * Fetches Mission 1.
 *
 * The suggestion chip is assembled here rather than declared on `Mission`: its value is already
 * in `LESSON_INPUTS.mission.cost`, which is what the mission's own first step is judged against,
 * and a second copy of the figure beside it is a second thing to keep in step with the engine.
 */
export async function loadMission(): Promise<MissionDefinition | null> {
  try {
    const module = await import('../lessons')
    const mission = module.loadMission()
    return {
      steps: mission.steps,
      storyKey: mission.storyKey,
      suggestion: {
        field: 'cost',
        value: module.LESSON_INPUTS.mission.cost,
        labelKey: 'learn.mission.suggestCost',
      },
    }
  } catch {
    return null
  }
}

/** True when lesson scripts can be fetched at all. The centre uses it to explain itself honestly. */
export function lessonsAvailable(): boolean {
  return true
}

/**
 * Fetches one lesson, or `null` when there is none.
 *
 * Never throws. A chunk that fails to load — offline against a redeployed build, a cache miss —
 * must leave the shopkeeper in the centre with a message, not in a half-built overlay.
 */
export async function loadLesson(id: LessonId): Promise<LessonDefinition | null> {
  try {
    const module = await import('../lessons')
    return module.loadLesson(id)
  } catch {
    return null
  }
}
