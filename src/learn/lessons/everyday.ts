/**
 * Lesson 7 — «کار هر روز»
 *
 * Market day. Two calculations, both into the basket, and the totals at the bottom are what
 * «آقا رضا» actually needs: what the pair earns him together. Then the day's takings leave the
 * phone as a CSV he keeps for himself.
 *
 * The share-link step is gone, and was the right thing to spend: this lesson is at the plan's
 * ninety-second cap, the oil needed a second step to be safe to teach, and «یک لینک برای مشتری»
 * was one informational tap sitting in the middle of «two calculations → total them», between
 * the second basket line and the basket. Sending a result to a customer is not lost — `profit`
 * teaches it at `profit.read`, on a result card with nothing else going on.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, committed, opened, tapped } from './predicates'
import { TUTORIAL_ROUNDING_STEP } from './rate'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.everyday
const ANSWER = LESSON_EXPECTED.everyday

export const everydayLesson: Lesson = {
  id: 'everyday',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.everyday.title',
  summaryKey: 'learn.lessons.everyday.body',
  estimateSeconds: 90,
  showsRate: false,
  steps: [
    {
      id: 'rice',
      target: 'calc-panel',
      textKey: 'learn.everyday.rice',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'profit' }),
      expect: committed('margin', Number(IN.riceMargin)),
      demo: {
        actions: [
          { target: 'field-cost', type: 'type', value: IN.riceCost },
          { target: 'field-margin', type: 'type', value: IN.riceMargin },
        ],
      },
    },
    {
      id: 'calcRice',
      target: 'btn-calculate',
      textKey: 'learn.everyday.calcRice',
      placement: 'top',
      expect: calculated('profit'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'basketRice',
      target: 'btn-add-basket',
      textKey: 'learn.everyday.basketRice',
      expect: tapped('add-to-basket'),
      demo: { actions: [{ target: 'btn-add-basket', type: 'tap' }] },
    },
    {
      /* Two steps for the oil, where the rice took one, because the panel is not empty this time.
       * The mode has not changed since the rice, so its 2,480,000 and its 12 are still in the
       * fields — and a single step waiting on the margin could be satisfied by editing the margin
       * alone, leaving the rice's purchase price underneath it. The cutout would then move on to
       * Calculate, the cost field would go inert with the wrong figure in it, and the lesson
       * would total a basket its own challenge disagrees with. So the cost is asked for first,
       * and the step does not advance until it has actually been replaced. */
      id: 'oilCost',
      target: 'field-cost',
      textKey: 'learn.everyday.oilCost',
      expect: committed('cost', Number(IN.oilCost)),
      demo: { actions: [{ target: 'field-cost', type: 'type', value: IN.oilCost }] },
    },
    {
      id: 'oilMargin',
      target: 'field-margin',
      textKey: 'learn.everyday.oilMargin',
      expect: committed('margin', Number(IN.oilMargin)),
      demo: { actions: [{ target: 'field-margin', type: 'type', value: IN.oilMargin }] },
    },
    {
      id: 'calcOil',
      target: 'btn-calculate',
      textKey: 'learn.everyday.calcOil',
      placement: 'top',
      expect: calculated('profit'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'basketOil',
      target: 'btn-add-basket',
      textKey: 'learn.everyday.basketOil',
      expect: tapped('add-to-basket'),
      demo: { actions: [{ target: 'btn-add-basket', type: 'tap' }] },
    },
    {
      id: 'totals',
      target: 'btn-basket-open',
      textKey: 'learn.everyday.totals',
      expect: opened('basket'),
      demo: { actions: [{ target: 'btn-basket-open', type: 'tap' }] },
    },
    {
      /* History is opened for the learner rather than tapped: the basket sheet is in the way, and
       * the tooltip naming the clock button in the header is cheaper than two more steps. */
      id: 'csv',
      target: 'btn-export-csv',
      textKey: 'learn.everyday.csv',
      before: (ctx) => ctx.navigate({ sheet: 'history' }),
      expect: tapped('export-csv'),
      demo: { actions: [{ target: 'btn-export-csv', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      kind: 'number',
      id: 'combined',
      promptKey: 'learn.everyday.challenge.combined.prompt',
      hintKey: 'learn.everyday.challenge.combined.hint',
      answer: ANSWER.combinedProfit,
      /* Two rounding steps, because there are two roundings in the answer. The figure asked for
       * is what the app shows — 308,000, off two prices it rounded up — and a learner who does
       * the arithmetic exactly gets 307,040, which is 960 away and was passing by 40 toman. The
       * mistakes worth failing (one line instead of both, the prices instead of the profits) are
       * tens of thousands out, so nothing is let through by the extra step. */
      tolerance: TUTORIAL_ROUNDING_STEP * 2,
      unit: 'money',
    },
  ],
}
