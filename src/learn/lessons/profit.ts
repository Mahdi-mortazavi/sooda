/**
 * Lesson 1 — «چقدر بفروشم؟»
 *
 * The first thing «آقا رضا» ever asked Sooda: he paid 150,000 for a shawl and wants a quarter on
 * top. Then the same question from the other end — the price is fixed, what does it actually
 * earn? — which is also the only way to show him the card turning red.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, committed, switchedTo, tapped } from './predicates'
import { TUTORIAL_ROUNDING_STEP } from './rate'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.profit
const ANSWER = LESSON_EXPECTED.profit

export const profitLesson: Lesson = {
  id: 'profit',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.profit.title',
  summaryKey: 'learn.lessons.profit.body',
  estimateSeconds: 70,
  // Nothing here is aged: the lens stays off, so no rate is involved and none is claimed.
  showsRate: false,
  steps: [
    {
      id: 'cost',
      target: 'field-cost',
      textKey: 'learn.profit.cost',
      placement: 'bottom',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'profit' }),
      expect: committed('cost', Number(IN.cost)),
      demo: { actions: [{ target: 'field-cost', type: 'type', value: IN.cost }] },
    },
    {
      id: 'margin',
      target: 'field-margin',
      textKey: 'learn.profit.margin',
      placement: 'bottom',
      expect: committed('margin', Number(IN.margin)),
      demo: { actions: [{ target: 'field-margin', type: 'type', value: IN.margin }] },
    },
    {
      id: 'calculate',
      target: 'btn-calculate',
      textKey: 'learn.profit.calculate',
      placement: 'top',
      expect: calculated('profit'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'read',
      target: 'result-card',
      textKey: 'learn.profit.read',
      placement: 'top',
      expect: tapped('copy-result'),
      demo: { actions: [{ target: 'btn-copy', type: 'tap' }] },
    },
    {
      id: 'toSell',
      target: 'seg-sell',
      textKey: 'learn.profit.toSell',
      expect: switchedTo('sell'),
      demo: { actions: [{ target: 'seg-sell', type: 'tap' }] },
    },
    {
      /* Each mode keeps its own inputs, so the purchase price is typed again here — and that is
       * the point of the step: the same 150,000, now against a price that does not cover it. */
      id: 'undercut',
      target: 'calc-panel',
      textKey: 'learn.profit.undercut',
      expect: committed('price', Number(IN.sellPrice)),
      demo: {
        actions: [
          { target: 'field-cost', type: 'type', value: IN.cost },
          { target: 'field-price', type: 'type', value: IN.sellPrice },
        ],
      },
    },
    {
      id: 'loss',
      target: 'btn-calculate',
      textKey: 'learn.profit.loss',
      placement: 'top',
      expect: calculated('sell'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      kind: 'number',
      id: 'price',
      promptKey: 'learn.profit.challenge.price',
      answer: ANSWER.sellingPrice,
      /* One rounding step of slack: the card rounds the suggested price up, and a shopkeeper who
       * worked it out in their head has the exact figure, not the rounded one. Both are right. */
      tolerance: TUTORIAL_ROUNDING_STEP,
      unit: 'money',
    },
  ],
}
