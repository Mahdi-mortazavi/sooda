/**
 * The seam between the Learning Centre and `src/learn/lessons/**`.
 *
 * One `import()`, in one place. The centre draws eight cards, a duration and a status before the
 * shopkeeper has chosen anything, and it does that from `catalog.ts` alone — pulling eight lesson
 * scripts in to render a list would make opening the centre cost as much as taking every lesson.
 * Only starting one reaches through here.
 */

import type { Lesson, Mission } from '../lessons/types'
import type { LessonId } from './types'

export type LessonDefinition = Lesson

/**
 * Mission 1 — the ≤30-second first run, which is deliberately not one of the eight lessons.
 *
 * It never enters `LESSON_IDS`, never gets a card in the centre and never touches the progress
 * store's lesson map: it is the welcome, not a lesson someone can pass. `lessons` owns the script.
 */
export type MissionDefinition = Mission

/** Fetches Mission 1. Handed over whole — every figure in it is the engine's, including the chip's. */
export async function loadMission(): Promise<MissionDefinition | null> {
  try {
    return (await import('../lessons')).loadMission()
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
