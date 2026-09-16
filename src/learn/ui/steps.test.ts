/**
 * The fold that turns a lesson's `task` challenges into steps.
 *
 * Worth its own file for one reason: a field quietly missing here does not fail anywhere. The
 * coach runs the step it is given, the tooltip appears, «نشانم بده» plays the demo — and the
 * lesson dead-ends only if the control the demo needs happens not to be on screen already. That
 * is how a dropped `before` shipped: two of the three tasks were rescued by the previous step
 * having left the right sheet open, and only lesson 5 ever showed the bug.
 */

import { describe, expect, it } from 'vitest'
import { splitChallenges } from './steps'
import type { LessonStep, TourCtx, TourDestination } from '../coach/types'
import type { Challenge } from '../lessons/types'
import { LESSONS } from '../lessons'

const step = (id: string): LessonStep => ({
  id,
  target: 'calc-panel',
  textKey: `learn.${id}`,
  expect: () => false,
})

const task = (over: Partial<Extract<Challenge, { kind: 'task' }>> = {}): Challenge => ({
  kind: 'task',
  id: 'bulk',
  promptKey: 'learn.products.challenge.bulk.prompt',
  hintKey: 'learn.products.challenge.bulk.hint',
  target: 'bulk-panel',
  done: () => true,
  demo: { actions: [{ target: 'btn-bulk-apply', type: 'tap' }] },
  ...over,
})

const question: Challenge = {
  kind: 'number',
  id: 'monthly',
  promptKey: 'learn.p',
  hintKey: 'learn.h',
  answer: 1,
  tolerance: 0,
  unit: 'money',
}

describe('splitChallenges', () => {
  it('appends a task to the steps and leaves the questions alone', () => {
    const split = splitChallenges([step('one')], [question, task()])
    expect(split.steps.map((s) => s.id)).toEqual(['one', 'bulk'])
    expect(split.quiz).toEqual([question])
  })

  it('carries a task’s `before` onto the step, so it opens its own sheet', async () => {
    const asked: unknown[] = []
    const before = async (ctx: TourCtx) => {
      await ctx.navigate({ tab: 'products', sheet: 'bulk-reprice' })
    }
    const split = splitChallenges([], [task({ before })])
    const folded = split.steps[0]
    expect(folded?.before).toBeDefined()
    await folded?.before?.({
      emit: () => undefined,
      sandbox: { products: [], observations: [], history: [], basket: [], profile: null },
      refreshSandbox: async () => undefined,
      navigate: async (to: TourDestination) => {
        asked.push(to)
      },
    } as unknown as TourCtx)
    expect(asked).toEqual([{ tab: 'products', sheet: 'bulk-reprice' }])
  })

  it('leaves a task with no `before` without one, rather than an undefined key', () => {
    const [folded] = splitChallenges([], [task()]).steps
    expect(folded).toBeDefined()
    expect('before' in (folded as object)).toBe(false)
  })

  /* The claim the two above only make in the abstract: every task the shipped lessons declare a
   * `before` for still has it after the fold. Reading the real lessons means a new task challenge
   * is covered the day it is written, without anybody remembering to extend this file. */
  it('keeps the `before` of every task challenge the lessons actually declare', () => {
    const withBefore = LESSONS.flatMap((lesson) =>
      lesson.challenges
        .filter((c): c is Extract<Challenge, { kind: 'task' }> => c.kind === 'task' && c.before !== undefined)
        .map((c) => ({ lesson: lesson.id, challenge: c.id })),
    )
    expect(withBefore.length).toBeGreaterThan(0)
    for (const { lesson: id, challenge } of withBefore) {
      const lesson = LESSONS.find((l) => l.id === id)
      const folded = splitChallenges(lesson?.steps ?? [], lesson?.challenges ?? []).steps.find(
        (s) => s.id === challenge,
      )
      expect(folded, `${id}/${challenge} was not folded into the steps`).toBeDefined()
      expect(folded?.before, `${id}/${challenge} lost its \`before\``).toBeDefined()
    }
  })
})
