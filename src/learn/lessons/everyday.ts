/**
 * Lesson 7 — «کار هر روز»
 *
 * Market day. Two calculations, both into the basket, and the totals at the bottom are what
 * «آقا رضا» actually needs: what the pair earns him together. Then the two ways a figure leaves
 * the phone — a link to one customer, a CSV of everything to himself.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, committed, opened, tapped } from './predicates'
import { TUTORIAL_ROUNDING_STEP } from './rate'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.everyday
const ANSWER = LESSON_EXPECTED.everyday

export const everydayLesson: Lesson = {
  id: 'everyday',
  titleKey: 'learn.everyday.title',
  summaryKey: 'learn.everyday.summary',
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
      id: 'oil',
      target: 'calc-panel',
      textKey: 'learn.everyday.oil',
      expect: committed('margin', Number(IN.oilMargin)),
      demo: {
        actions: [
          { target: 'field-cost', type: 'type', value: IN.oilCost },
          { target: 'field-margin', type: 'type', value: IN.oilMargin },
        ],
      },
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
      id: 'share',
      target: 'btn-share',
      textKey: 'learn.everyday.share',
      expect: tapped('share-link'),
      demo: { actions: [{ target: 'btn-share', type: 'tap' }] },
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
      promptKey: 'learn.everyday.challenge.combined',
      answer: ANSWER.combinedProfit,
      tolerance: TUTORIAL_ROUNDING_STEP,
      unit: 'money',
    },
  ],
}
