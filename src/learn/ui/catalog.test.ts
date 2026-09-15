/**
 * The centre's card for a lesson has to describe the lesson.
 *
 * `catalog.ts` carries an id and a duration for each of the eight so that opening the Learning
 * Centre costs nothing — drawing the list from the lesson scripts would make it cost as much as
 * taking every lesson. The price of that is a second copy of two facts, and this is what keeps
 * the copy honest: a lesson that gains a step and re-estimates its time, or an id that is
 * renamed, fails here rather than showing a shopkeeper «۵۵ ثانیه» for something that takes 85.
 */

import { describe, expect, it } from 'vitest'
import { LESSONS as LESSON_SCRIPTS } from '../lessons'
import { LESSONS, recommendedPath } from './catalog'
import { GOAL_IDS, LESSON_IDS } from './types'

describe('the lesson catalogue', () => {
  it('lists exactly the lessons that exist, in a stable order', () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual([...LESSON_IDS])
    expect([...LESSON_SCRIPTS.map((lesson) => lesson.id)].sort()).toEqual([...LESSON_IDS].sort())
  })

  it('quotes each lesson its own estimate', () => {
    for (const script of LESSON_SCRIPTS) {
      const card = LESSONS.find((lesson) => lesson.id === script.id)
      expect(card, script.id).toBeDefined()
      expect(card?.seconds, script.id).toBe(script.estimateSeconds)
    }
  })

  it('never offers a duration the plan does not allow', () => {
    // Mission 1 is capped at 30 and is not in here; a lesson is capped at 90.
    for (const lesson of LESSONS) expect(lesson.seconds, lesson.id).toBeLessThanOrEqual(90)
  })

  it('answers every goal with a lesson that exists', () => {
    for (const goal of GOAL_IDS) {
      const path = recommendedPath([goal])
      expect(path).toHaveLength(LESSON_IDS.length)
      // The goal's own answer leads, and it is a real lesson.
      expect(LESSON_IDS).toContain(path[0])
    }
  })
})
