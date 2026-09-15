/**
 * Lesson 2 — «تخفیف، و راه برگشتش»
 *
 * Nowruz is coming and «آقا رضا» wants 30% off a 500,000 rug. Then the question every shopper
 * asks him back: the sign says 350,000 after 30% off — what was it before?
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, committed, switchedTo } from './predicates'
import { TUTORIAL_ROUNDING_STEP } from './rate'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.discount
const ANSWER = LESSON_EXPECTED.discount

export const discountLesson: Lesson = {
  id: 'discount',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.discount.title',
  summaryKey: 'learn.lessons.discount.body',
  estimateSeconds: 55,
  showsRate: false,
  steps: [
    {
      id: 'fill',
      target: 'calc-panel',
      textKey: 'learn.discount.fill',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'discount' }),
      expect: committed('off', Number(IN.off)),
      demo: {
        actions: [
          { target: 'field-price', type: 'type', value: IN.original },
          { target: 'field-off', type: 'type', value: IN.off },
        ],
      },
    },
    {
      id: 'calculate',
      target: 'btn-calculate',
      textKey: 'learn.discount.calculate',
      placement: 'top',
      expect: calculated('discount'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'reverse',
      target: 'seg-rdiscount',
      textKey: 'learn.discount.reverse',
      expect: switchedTo('rdiscount'),
      demo: { actions: [{ target: 'seg-rdiscount', type: 'tap' }] },
    },
    {
      /* The figure typed here is the answer the forward half just produced, so the two directions
       * cannot drift apart: whatever the engine says 30% off 500,000 is, that is what goes back in. */
      id: 'fillBack',
      target: 'calc-panel',
      textKey: 'learn.discount.fillBack',
      expect: committed('off', Number(IN.off)),
      demo: {
        actions: [
          { target: 'field-final', type: 'type', value: IN.final },
          { target: 'field-off', type: 'type', value: IN.off },
        ],
      },
    },
    {
      id: 'calculateBack',
      target: 'btn-calculate',
      textKey: 'learn.discount.calculateBack',
      placement: 'top',
      expect: calculated('rdiscount'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      /* A different sale from the one the lesson just ran. The lesson says «قیمت اصلی ۵۰۰٬۰۰۰»
       * in its first tooltip and then puts that same 500,000 back on the screen at the last
       * step, so asking for it afterwards marked whether the learner had been listening. The
       * premise here — 360,000 on the sign, 20% already off — is one they have to reverse. */
      kind: 'number',
      id: 'original',
      promptKey: 'learn.discount.challenge.original',
      hintKey: 'learn.discount.challenge.original.hint',
      answer: ANSWER.challenge.originalPrice,
      tolerance: TUTORIAL_ROUNDING_STEP,
      unit: 'money',
    },
  ],
}
