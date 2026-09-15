/**
 * Lesson 5 — «کالاهای من»
 *
 * «آقا رضا» is trying a new line of tea. He prices it, saves it, and finds the shop already knows
 * his rice is in trouble. Then the supplier raises everything at once, which is what the group
 * reprice is for — previewed first, undoable after.
 */

import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { calculated, committed, opened, tapped } from './predicates'
import type { SandboxState } from '../coach/types'
import type { Lesson } from './types'

const IN = LESSON_INPUTS.products
const ANSWER = LESSON_EXPECTED.products

/**
 * Has the group reprice landed?
 *
 * Checked against the shop rather than against the tap, because "the run was applied" is a fact
 * about the rows, not about a button. The rice is deliberately not among the rows checked: the
 * learner edits its cost by hand two steps earlier, so asserting on it would be marking their
 * typing rather than the reprice. The event itself is ignored — the coach refreshes the store
 * before judging, so the first event to arrive after the write finds the new costs in place.
 */
function repriced(_ev: unknown, state: SandboxState): boolean {
  return ANSWER.newCosts.every((row) => {
    const product = state.products.find((p) => p.id === row.id)
    return product !== undefined && product.cost === row.cost
  })
}

export const productsLesson: Lesson = {
  id: 'products',
  /* The Learning Centre's card already has a title and a blurb for this lesson, and one
   * lesson does not need two of each — so these point at the catalogue's own keys. */
  titleKey: 'learn.lessons.products.title',
  summaryKey: 'learn.lessons.products.body',
  estimateSeconds: 85,
  showsRate: true,
  steps: [
    {
      id: 'price',
      target: 'calc-panel',
      textKey: 'learn.products.price',
      before: (ctx) => ctx.navigate({ tab: 'calculator', mode: 'profit' }),
      expect: committed('margin', Number(IN.margin)),
      demo: {
        actions: [
          { target: 'field-cost', type: 'type', value: IN.cost },
          { target: 'field-margin', type: 'type', value: IN.margin },
        ],
      },
    },
    {
      id: 'calculate',
      target: 'btn-calculate',
      textKey: 'learn.products.calculate',
      placement: 'top',
      expect: calculated('profit'),
      demo: { actions: [{ target: 'btn-calculate', type: 'tap' }] },
    },
    {
      id: 'save',
      target: 'btn-save-product',
      textKey: 'learn.products.save',
      expect: opened('save-product'),
      demo: { actions: [{ target: 'btn-save-product', type: 'tap' }] },
    },
    {
      id: 'name',
      target: 'save-product-panel',
      textKey: 'learn.products.name',
      expect: tapped('save-product'),
      demo: {
        actions: [
          { target: 'field-product-name', type: 'type', value: IN.name },
          { target: 'btn-save-confirm', type: 'tap' },
        ],
      },
    },
    {
      /* The default sort puts the worst real margin first, and the demo shop's rice is priced off
       * the sack before last — so the row under the cutout is the red one the tooltip talks about. */
      id: 'health',
      target: 'product-row',
      textKey: 'learn.products.health',
      before: (ctx) => ctx.navigate({ tab: 'products' }),
      expect: opened('product'),
      demo: { actions: [{ target: 'product-row', type: 'tap' }] },
    },
    {
      id: 'newCost',
      target: 'product-new-cost',
      textKey: 'learn.products.newCost',
      expect: tapped('apply-new-cost'),
      demo: {
        actions: [
          { target: 'btn-new-cost-open', type: 'tap' },
          { target: 'field-new-cost', type: 'type', value: IN.newCost },
          { target: 'btn-new-cost-apply', type: 'tap' },
        ],
      },
    },
  ],
  challenges: [
    {
      kind: 'task',
      id: 'bulk',
      promptKey: 'learn.products.challenge.bulk',
      hintKey: 'learn.products.challenge.bulk.hint',
      target: 'bulk-panel',
      before: (ctx) => ctx.navigate({ tab: 'products', sheet: 'bulk-reprice' }),
      done: repriced,
      demo: {
        actions: [
          { target: 'chip-bulk-costup', type: 'tap' },
          { target: 'field-bulk-percent', type: 'type', value: IN.bulkPercent },
          { target: 'btn-bulk-apply', type: 'tap' },
        ],
      },
    },
  ],
}
