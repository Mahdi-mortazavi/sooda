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
import type { Observation } from '../../lib/db'
import type { SandboxState } from '../coach/types'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.smartRates
const ANSWER = LESSON_EXPECTED.smartRates

/**
 * What the last reading before this one said, for the product it was written against.
 *
 * "No change" writes the cost forward unaltered, so the previous reading is the only thing that
 * separates a price the learner typed from a price they merely confirmed — the event says
 * `record-cost` either way, and the product's own `cost` is no help because recording a price
 * moves it. Excluded rows are skipped for the same reason the sheet skips them: a disowned sale
 * price is not what «تغییری نکرده» would have repeated.
 */
function previousCost(state: SandboxState, reading: Observation): number | null {
  const earlier = state.observations
    .filter((o) => o.productId === reading.productId && o.excluded !== true && o.id < reading.id)
    .sort((a, b) => a.id - b.id)
  const last = earlier[earlier.length - 1]
  if (last !== undefined) return last.cost
  /* No earlier reading at all: fall back to the product's stamped cost, which is what the sheet
   * itself would have repeated. Unreachable in the demo shop — every row there has a history —
   * but a challenge must not pass or fail on a shape it did not expect. */
  return state.products.find((p) => p.id === reading.productId)?.cost ?? null
}

/**
 * A real check-in: one price written down, and one confirmed.
 *
 * Counted from the shop rather than from the taps, because "record" and "no change" both write an
 * ordinary reading and there is nothing in the event to tell them apart. The demo shop ships with
 * a `checkin` reading of its own, so only rows written after the seed are counted — the seed's ids
 * run 1…`seedObservationCount`, and every row the learner adds lands above that.
 *
 * Two distinct products, as before, and now what was done to them: at least one reading that
 * DIFFERS from what that product last cost, which is a price somebody typed, and at least one
 * that repeats it, which is «تغییری نکرده». Marking both unchanged used to pass — two taps, no
 * price — and this lesson's whole claim is that recorded prices are what make the estimate worth
 * trusting. The prompt has always asked for exactly this; only the marking was lenient.
 */
function checkedIn(_ev: unknown, state: SandboxState): boolean {
  const fresh = state.observations.filter((o) => o.source === 'checkin' && o.id > ANSWER.seedObservationCount)
  if (new Set(fresh.map((o) => o.productId)).size < 2) return false

  let recorded = false
  let confirmed = false
  for (const reading of fresh) {
    const previous = previousCost(state, reading)
    if (previous === null) continue
    if (reading.cost === previous) confirmed = true
    else recorded = true
  }
  return recorded && confirmed
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
      /* One price written down, then one confirmed — the two halves of the answer the prompt
       * asks for, in the order the sheet offers them. The typed figure is safe to script because
       * the check-in's order is the seed's rather than the clock's: the notebook is always first,
       * and `lessons.test.ts` pins that. `checkInCost` is its own last price carried forward at
       * the pinned rate, so it is in the scale the card beside it shows and well inside the
       * sheet's outlier window — a dialog here would strand the finger behind a question only a
       * human can answer. */
      demo: {
        actions: [
          { target: 'field-checkin-cost', type: 'type', value: IN.checkInCost },
          { target: 'btn-checkin-record', type: 'tap' },
          { target: 'btn-checkin-unchanged', type: 'tap' },
        ],
      },
    },
  ],
}
