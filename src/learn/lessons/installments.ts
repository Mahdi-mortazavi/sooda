/**
 * Lesson 4 — «قسطی»
 *
 * A customer wants the 12,000,000 heater over six months with nothing down. What is a fair
 * instalment — and is the flat 2% a month the shop across the road charges actually better than
 * taking the cash? The second question is the one nobody works out by hand.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, chose, committed, opened, switchedTo } from './predicates'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.installments
const ANSWER = LESSON_EXPECTED.installments

/** See the challenge below: this is the width of a remembered figure, not of a rounding step. */
const MONTHLY_TOLERANCE = 50_000

export const installmentsLesson: Lesson = {
  id: 'installments',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.installments.title',
  summaryKey: 'learn.lessons.installments.body',
  estimateSeconds: 85,
  showsRate: true,
  steps: [
    {
      id: 'toInstallments',
      target: 'seg-installments',
      textKey: 'learn.installments.toInstallments',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'profit' }),
      expect: switchedTo('installment'),
      demo: { actions: [{ target: 'seg-installments', type: 'tap' }] },
    },
    {
      /* The down payment is left empty on purpose and the tooltip says why — «هیچی نقد نمی‌دهد».
       * An optional field validates as zero, so there is nothing to type. */
      id: 'cash',
      target: 'calc-panel',
      textKey: 'learn.installments.cash',
      expect: committed('cash', Number(IN.cash)),
      demo: { actions: [{ target: 'field-cash', type: 'type', value: IN.cash }] },
    },
    {
      id: 'count',
      target: 'field-n',
      textKey: 'learn.installments.count',
      expect: chose('n', IN.count),
      demo: { actions: [{ target: 'chip-n-6', type: 'tap' }] },
    },
    {
      id: 'calculate',
      target: 'btn-calculate',
      textKey: 'learn.installments.calculate',
      placement: 'top',
      expect: calculated('installment'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'toReverse',
      target: 'seg-rinstallment',
      textKey: 'learn.installments.toReverse',
      expect: switchedTo('rinstallment'),
      demo: { actions: [{ target: 'seg-rinstallment', type: 'tap' }] },
    },
    {
      /* Six is already the default count here, so only the two figures that differ are typed. */
      id: 'neighbour',
      target: 'calc-panel',
      textKey: 'learn.installments.neighbour',
      expect: committed('flat', Number(IN.flat)),
      demo: {
        actions: [
          { target: 'field-cash', type: 'type', value: IN.cash },
          { target: 'field-flat', type: 'type', value: IN.flat },
        ],
      },
    },
    {
      id: 'judge',
      target: 'btn-calculate',
      textKey: 'learn.installments.judge',
      placement: 'top',
      expect: calculated('rinstallment'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      /* Last, because the sheet covers the screen: there is no step after it that would need the
       * learner to close something first. */
      id: 'schedule',
      target: 'btn-schedule',
      textKey: 'learn.installments.schedule',
      expect: opened('schedule'),
      demo: { actions: [{ target: 'btn-schedule', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      /* Asked from memory, and answered from memory: the challenges run after the practice shop
       * has been torn down, so there is no calculator to redo 12,000,000 over six months on.
       * Every other figure a lesson asks for is round; this one is 2,215,170.01, and a rounding
       * step of slack would have made the question "recite seven digits". Fifty thousand is the
       * width of "he remembered it was a bit over 2.2 million" — and it still rejects the one
       * wrong answer worth rejecting, the 2,000,000 of a cash price split six ways, by more than
       * four times the slack. */
      kind: 'number',
      id: 'monthly',
      promptKey: 'learn.installments.challenge.monthly',
      hintKey: 'learn.installments.challenge.monthly.hint',
      answer: ANSWER.monthly,
      tolerance: MONTHLY_TOLERANCE,
      unit: 'money',
    },
    {
      kind: 'choice',
      id: 'verdict',
      promptKey: 'learn.installments.challenge.verdict.prompt',
      hintKey: 'learn.installments.challenge.verdict.hint',
      /* The bar is a cash sale — exactly what the reverse card itself judges against. */
      options: [
        {
          id: 'better',
          labelKey: 'learn.installments.challenge.verdict.better',
          correct: ANSWER.reverseVerdict !== 'losing',
        },
        {
          id: 'worse',
          labelKey: 'learn.installments.challenge.verdict.worse',
          correct: ANSWER.reverseVerdict === 'losing',
        },
      ],
    },
  ],
}
