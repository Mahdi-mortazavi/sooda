/**
 * Lesson 6 — «نرخ هوشمند»
 *
 * Where the per-product growth estimate comes from, why it is allowed to disagree with the
 * national figure, and how «آقا رضا» overrules it when he knows better. It ends in the check-in,
 * which is the habit that makes every other estimate in the app worth trusting.
 */

import { REQUESTED_TOUR_ACTIONS } from './actions'
import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { closed, opened, tapped } from './predicates'
import type { SandboxState } from '../coach/types'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.smartRates
const ANSWER = LESSON_EXPECTED.smartRates

/**
 * Two products asked about in this check-in.
 *
 * Counted from the shop rather than from the taps, because "record" and "no change" both write an
 * ordinary reading and there is nothing in the event to tell them apart. The demo shop ships with
 * a `checkin` reading of its own, so only rows written after the seed are counted — the seed's ids
 * run 1…`seedObservationCount`, and every row the learner adds lands above that.
 */
function checkedIn(_ev: unknown, state: SandboxState): boolean {
  const fresh = state.observations.filter((o) => o.source === 'checkin' && o.id > ANSWER.seedObservationCount)
  return new Set(fresh.map((o) => o.productId)).size >= 2
}

export const smartRatesLesson: Lesson = {
  id: 'smartRates',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.smartRates.title',
  summaryKey: 'learn.lessons.smartRates.body',
  estimateSeconds: 80,
  showsRate: true,
  steps: [
    {
      /* The shelf and the dollar question in one step: the sheet saves and closes together, so
       * the close is what says the setup was answered rather than merely opened. */
      id: 'profile',
      target: 'profile-panel',
      textKey: 'learn.smartRates.profile',
      before: (ctx) => ctx.navigate({ sheet: 'store-profile' }),
      expect: closed('store-profile'),
      demo: { actions: [{ target: 'btn-profile-save', type: 'tap' }] },
    },
    {
      id: 'why',
      target: 'rate-card',
      textKey: 'learn.smartRates.why',
      before: (ctx) => ctx.navigate({ tab: 'products', sheet: 'product' }),
      expect: tapped(REQUESTED_TOUR_ACTIONS.rateWhy),
      demo: { actions: [{ target: 'btn-rate-why', type: 'tap' }] },
    },
    {
      id: 'manual',
      target: 'rate-card',
      textKey: 'learn.smartRates.manual',
      expect: tapped(REQUESTED_TOUR_ACTIONS.rateManual),
      demo: {
        actions: [
          { target: 'btn-rate-manual', type: 'tap' },
          { target: 'field-manual-rate', type: 'type', value: IN.manualRate },
          { target: 'btn-manual-commit', type: 'tap' },
        ],
      },
    },
    {
      id: 'auto',
      target: 'btn-rate-auto',
      textKey: 'learn.smartRates.auto',
      expect: tapped(REQUESTED_TOUR_ACTIONS.rateAuto),
      demo: { actions: [{ target: 'btn-rate-auto', type: 'tap' }] },
    },
    {
      id: 'checkin',
      target: 'checkin-card',
      textKey: 'learn.smartRates.checkin',
      before: (ctx) => ctx.navigate({ tab: 'products' }),
      expect: opened('check-in'),
      demo: { actions: [{ target: 'checkin-card', type: 'tap' }] },
    },
  ],
  challenges: [
    {
      kind: 'task',
      id: 'record',
      promptKey: 'learn.smartRates.challenge.record',
      target: 'checkin-panel',
      before: (ctx) => ctx.navigate({ tab: 'products', sheet: 'check-in' }),
      done: checkedIn,
      /* «نشانم بده» marks both unchanged. A typed figure would have to be chosen before anyone
       * knows which product the check-in offers first, and a number that is out of scale for that
       * product trips the outlier dialog — so the finger takes the path that is right for every
       * shop, and the prompt is what asks the learner to type a real price for one of them. */
      demo: {
        actions: [
          { target: 'btn-checkin-unchanged', type: 'tap' },
          { target: 'btn-checkin-unchanged', type: 'tap' },
        ],
      },
    },
  ],
}
