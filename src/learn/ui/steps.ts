/**
 * Turning a lesson's challenges into the two things that run them.
 *
 * It lives away from `LearnHost` because it is the one piece of that file with no React in it and
 * a contract worth pinning: a `task` challenge is «do it in the practice shop», which is what a
 * step already is — same target, same event-judged predicate, same demo, same `before`. So it is
 * appended to the steps and the coach runs it, rather than a second runner being built to do the
 * same job slightly differently. Everything else is a question, asked once the steps are done.
 */

import type { LessonStep } from '../coach/types'
import type { Challenge } from '../lessons/types'

export interface SplitChallenges {
  /** The lesson's own steps, with every `task` challenge appended as one more. */
  steps: LessonStep[]
  /** The typed and multiple-choice questions, in order, for the surface that asks them. */
  quiz: Challenge[]
}

export function splitChallenges(steps: LessonStep[], challenges: readonly Challenge[]): SplitChallenges {
  const tasks: LessonStep[] = []
  const quiz: Challenge[] = []
  for (const challenge of challenges) {
    if (challenge.kind !== 'task') {
      quiz.push(challenge)
      continue
    }
    tasks.push({
      id: challenge.id,
      target: challenge.target,
      textKey: challenge.promptKey,
      expect: challenge.done,
      demo: challenge.demo,
      /*
       * A task is a step, and that includes where it has to be done.
       *
       * This was dropped, and two of the three tasks survived it by luck: the sheet their
       * `before` asks for happened to be the one the previous step had left open. Lesson 5's
       * group reprice was not so lucky — it asked for the bulk panel with the product sheet
       * still covering the screen and the panel never mounted, so the last thing that lesson
       * teaches could not be done by anybody, demo or learner.
       */
      ...(challenge.before === undefined ? {} : { before: challenge.before }),
    })
  }
  return { steps: [...steps, ...tasks], quiz }
}
