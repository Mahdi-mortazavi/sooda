/**
 * The seam between the Learning Centre and `src/learn/lessons/**`.
 *
 * One `import()`, in one place. The centre draws eight cards, a duration and a status before the
 * shopkeeper has chosen anything, and it does that from `catalog.ts` alone — pulling eight lesson
 * scripts in to render a list would make opening the centre cost as much as taking every lesson.
 * Only starting one reaches through here.
 */

import type { Lesson } from '../lessons/types'
import type { LessonId } from './types'

export type LessonDefinition = Lesson

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
