/**
 * The seam between the Learning Centre and `src/learn/lessons/**`.
 *
 * `lessons` is a sibling agent's module and did not exist when the centre was built, so the centre
 * cannot name it: a static import of a missing module fails the type-check and the build, and a
 * bare dynamic import of one fails at bundle time too. The seam is therefore explicit — one
 * constant to change, in one place, with the shape both sides agreed in the plan.
 *
 * WIRING (one line): when `src/learn/lessons/index.ts` lands, replace `LOADER = null` with
 *
 *   const LOADER: LessonLoader = (id) => import('../lessons').then((m) => m.loadLesson(id))
 *
 * and nothing else here or in `LearnHost` changes. Until then `loadLesson` resolves to `null`,
 * the centre says the lesson is not available yet and the rest of the tutorial — the tour of the
 * centre, onboarding, the progress ring, every entry point — works exactly as it will afterwards.
 */

import type { LessonStep } from '../coach/types'
import type { LessonId } from './types'

export interface LessonDefinition {
  id: LessonId
  steps: LessonStep[]
  /**
   * The instant the demo shop is dated from, so a challenge computed off the seed has the same
   * answer on every run. Handed straight to `enterPractice({ now })`.
   */
  now?: number
}

export type LessonLoader = (id: LessonId) => Promise<LessonDefinition | null>

const LOADER: LessonLoader | null = null

/** True when lesson scripts are wired up. The centre uses it to explain itself honestly. */
export function lessonsAvailable(): boolean {
  return LOADER !== null
}

/**
 * Fetches one lesson's steps, or `null` when there are none to fetch.
 *
 * Never throws: a chunk that fails to load (offline, a cache miss against a redeployed build) must
 * leave the shopkeeper in the centre with a message, not in a broken overlay.
 */
export async function loadLesson(id: LessonId): Promise<LessonDefinition | null> {
  if (LOADER === null) return null
  try {
    return await LOADER(id)
  } catch {
    return null
  }
}
