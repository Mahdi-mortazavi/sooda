/**
 * Lesson 3 — «سود واقعی»
 *
 * The oil on «آقا رضا»'s shelf shows a perfectly ordinary profit: he pays 118,000 and charges
 * 128,000. Three months of the pinned rate is all it takes for that to become a loss, and the
 * gap between the two figures is the whole reason Sooda exists — so the lesson makes it happen
 * on his own row rather than describing it.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, chose, committed } from './predicates'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.realProfit
const ANSWER = LESSON_EXPECTED.realProfit

export const realProfitLesson: Lesson = {
  id: 'realProfit',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.realProfit.title',
  summaryKey: 'learn.lessons.realProfit.body',
  estimateSeconds: 70,
  showsRate: true,
  steps: [
    {
      /* Both figures come from the demo shop's own oil row: what he last paid, and what the
       * shelf label says. Nothing is invented, so the lesson agrees with the products tab. */
      id: 'fill',
      target: 'calc-panel',
      textKey: 'learn.realProfit.fill',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'sell' }),
      expect: committed('price', Number(IN.price)),
      demo: {
        actions: [
          { target: 'field-cost', type: 'type', value: IN.cost },
          { target: 'field-price', type: 'type', value: IN.price },
        ],
      },
    },
    {
      id: 'nominal',
      target: 'btn-calculate',
      textKey: 'learn.realProfit.nominal',
      placement: 'top',
      expect: calculated('sell'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'months',
      target: 'field-months',
      textKey: 'learn.realProfit.months',
      expect: chose('months', IN.months),
      demo: { actions: [{ target: 'chip-months-3', type: 'tap' }] },
    },
    {
      id: 'verdict',
      target: 'btn-calculate',
      textKey: 'learn.realProfit.verdict',
      placement: 'top',
      expect: calculated('sell'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      /* The second source: an estimate is only a stand-in for a real quote, and a shopkeeper who
       * has one should say so. The cutout is the whole lens row, so the toggle and the field it
       * reveals are both reachable within the step. */
      id: 'known',
      target: 'lens-row',
      textKey: 'learn.realProfit.known',
      expect: committed('replacement', Number(IN.knownCost)),
      demo: {
        actions: [
          { target: 'chip-src-known', type: 'tap' },
          { target: 'field-replacement', type: 'type', value: IN.knownCost },
        ],
      },
    },
    {
      id: 'again',
      target: 'btn-calculate',
      textKey: 'learn.realProfit.again',
      placement: 'top',
      expect: calculated('sell'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      /*
       * Asked about ONE month, which the lesson never runs.
       *
       * Both of the lesson's own calculations are three months out, and the second of them is
       * still on the card when the question appears: «در واقع ضرر است» could be read straight
       * off the screen. The same oil sold within the month is a thin profit instead, so the
       * answer turns on the one thing the lesson is actually about — how long the money is out
       * — and cannot be reached by copying. It also closes a quieter hole: the old answer was
       * derived from the estimate at step 4 while the last run on screen was the supplier's
       * known price at step 6, two figures that agree today and nothing kept them agreeing.
       *
       * Which option is right is still the engine's answer and not the author's: `profitStatus`
       * judged the shelf price against one month of the pinned rate, and whatever it said stands.
       */
      kind: 'choice',
      id: 'verdict',
      promptKey: 'learn.realProfit.challenge.verdict.prompt',
      hintKey: 'learn.realProfit.challenge.verdict.hint',
      takeawayKey: 'learn.realProfit.challenge.verdict.takeaway',
      options: [
        {
          id: 'stillProfit',
          labelKey: 'learn.realProfit.challenge.verdict.stillProfit',
          correct: ANSWER.challenge.verdict !== 'losing',
        },
        {
          id: 'actuallyLoss',
          labelKey: 'learn.realProfit.challenge.verdict.actuallyLoss',
          correct: ANSWER.challenge.verdict === 'losing',
        },
      ],
    },
  ],
}
