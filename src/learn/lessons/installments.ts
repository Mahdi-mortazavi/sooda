/**
 * Lesson 4 — «قسطی»
 *
 * A customer wants the 12,000,000 heater over six months with nothing down. What is a fair
 * instalment — and is the flat 2% a month the shop across the road charges actually better than
 * taking the cash? The second question is the one nobody works out by hand.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, chose, committed, opened, switchedTo } from './predicates'
import { TUTORIAL_ROUNDING_STEP } from './rate'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.installments
const ANSWER = LESSON_EXPECTED.installments

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
      kind: 'number',
      id: 'monthly',
      promptKey: 'learn.installments.challenge.monthly',
      answer: ANSWER.monthly,
      tolerance: TUTORIAL_ROUNDING_STEP,
      unit: 'money',
    },
    {
      kind: 'choice',
      id: 'verdict',
      promptKey: 'learn.installments.challenge.verdict',
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
