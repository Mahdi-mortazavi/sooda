/**
 * Where every number a challenge checks comes from.
 *
 * NOTHING IN THE APP IMPORTS THIS FILE. It reaches into the engine — the mode behaviours, the
 * bulk-reprice preview, the basket totals — and a lesson chunk that dragged all of that in would
 * cost a shopkeeper bytes for a tutorial they may never open. The lessons import
 * `expected.generated.ts` instead: the committed snapshot of what this file returns.
 *
 * Two things read this one:
 *   `scripts/lesson-examples.mjs`  prints it, writes the snapshot (`--write`), or fails when the
 *                                  snapshot no longer matches the engine (`--check`);
 *   `expected.test.ts`             the same comparison, in the suite, with no esbuild involved.
 *
 * Every figure runs through the code the result card runs. Re-deriving "cost × 1.25, rounded up"
 * here would be a mirror of the engine, and a mirror can drift from what the shopkeeper is shown.
 */

import { profitStatus } from '../../lib/inflation'
import { computeBasketTotals, type BasketLine } from '../../lib/basket'
import { discountMode } from '../../lib/modes/discount'
import { installmentBehaviour } from '../../lib/modes/installment'
import { profitMode } from '../../lib/modes/profit'
import { reverseDiscountMode } from '../../lib/modes/rdiscount'
import { reverseInstallmentBehaviour } from '../../lib/modes/rinstallment'
import { sellMode } from '../../lib/modes/sell'
import type { CalcContext, ModeState } from '../../lib/modes/types'
import { previewBulk } from '../../lib/products'
import { buildSeed, SEED_PRODUCTS } from '../sandbox/seed'
import { TUTORIAL_MONTHLY_PERCENT, TUTORIAL_ROUNDING_STEP } from './rate'
import type { LessonExpected, LessonInputs } from './types'

/**
 * An arbitrary instant. No figure below depends on it — the lens is driven by the month chips and
 * the cost-up preview by a percentage, neither of which reads the clock — and `expected.test.ts`
 * proves that by computing everything again at a different one.
 */
export const PINNED_NOW = Date.UTC(2026, 8, 15)

/* ── the questions the lessons ask ────────────────────────────────────── */

/** «آقا رضا» buys at 150,000 and wants 25%. Lesson 1, and its challenge. */
const PROFIT_COST = 150_000
const PROFIT_MARGIN = 25
/** A 500,000 price tag at 30% off. Lesson 2 works it forward, the challenge works it back. */
const DISCOUNT_PRICE = 500_000
const DISCOUNT_OFF = 30
/** A 12,000,000 sale over six months, nothing down, against a neighbour's flat 2%/month. */
const INSTALLMENT_CASH = 12_000_000
const INSTALLMENT_COUNT = 6
const INSTALLMENT_DOWN = 0
const NEIGHBOUR_FLAT_PERCENT = 2
/** Undercutting his own cost by 10,000 — lesson 1's last step, where the card turns red. */
const PROFIT_UNDERCUT = 140_000
/** The lens horizon lesson 3 asks for, in months. */
const LENS_MONTHS_CHIP = 3
/** What the supplier quotes today for a bottle of oil — lesson 3 types it as a second opinion. */
const OIL_QUOTE = 130_000
/** And for a sack of rice: lesson 5 records it through the detail sheet's shortcut. */
const RICE_QUOTE = 2_700_000
/** The new line «آقا رضا» is trying out in lesson 5, before he has ever bought one. */
const TEA_COST = 120_000
const TEA_MARGIN = 20
/** What «نشانم بده» types into the name field. `copy` may want this in the locale files later. */
const TEA_NAME = 'چای کیسه‌ای'
/** The figure lesson 6 overrides the estimated rate with, before putting it back on automatic. */
const MANUAL_RATE_PERCENT = 4
/** Every purchase price in the shop has gone up by a tenth. Lesson 5's challenge. */
export const BULK_COST_UP_PERCENT = 10
/* Lesson 7 prices the rice and the oil at the margins the demo shop itself carries, so the two
 * basket lines are the shop's own rows rather than two numbers a lesson made up. */

function context(now: number, state: ModeState = {}): CalcContext {
  return {
    monthlyInflationPercent: TUTORIAL_MONTHLY_PERCENT,
    roundingStep: TUTORIAL_ROUNDING_STEP,
    now,
    state,
  }
}

/**
 * One row of the demo shop.
 *
 * `buildSeed` is called without a translator on purpose: names go through i18n now, figures do
 * not, and computing against the Persian defaults is what makes this script print the same
 * numbers whichever locale a maintainer happens to be running in.
 */
function seedProduct(now: number, id: number): { cost: number; price: number; margin: number } {
  const product = buildSeed(now).products.find((p) => p.id === id)
  if (product === undefined) throw new Error(`the demo shop has no product ${id}`)
  return { cost: product.cost, price: product.price, margin: product.targetMarginPercent }
}

/** Everything a challenge is marked against, computed by the app's own engine. */
export function computeLessonExpected(now: number = PINNED_NOW): LessonExpected {
  /* profit — the selling price and the profit at 25% on 150,000, rounded the way the card
   * rounds it. `profitAmount` is measured against the rounded price, not the exact one. */
  const profit = profitMode.compute({ cost: PROFIT_COST, margin: PROFIT_MARGIN }, context(now))

  /* discount — forward, then the reverse of the forward answer, so the two halves of the
   * lesson cannot disagree with each other. */
  const off = discountMode.compute({ price: DISCOUNT_PRICE, off: DISCOUNT_OFF }, context(now))
  const back = reverseDiscountMode.compute({ final: off.finalPrice, off: DISCOUNT_OFF }, context(now))

  /* realProfit — the demo shop's oil. It is the one row that reads as a perfectly ordinary
   * profit today (single digits, but a profit) and is a loss three months out, which is the
   * whole lesson. The rice is already losing before the lens is touched, so it would have
   * nothing left to reveal. */
  const oil = seedProduct(now, SEED_PRODUCTS.oil)
  const real = sellMode.compute({ cost: oil.cost, price: oil.price }, context(now, { months: String(LENS_MONTHS_CHIP) }))

  /* installments — six months, nothing down, at the pinned rate; then the same plan as the
   * neighbour offers it, at a flat 2% a month. The verdict is the engine's, not the author's:
   * a cash sale is the bar, which is what `profitStatus(x, 0)` measures against. */
  const instalmentValues = { cash: INSTALLMENT_CASH, n: INSTALLMENT_COUNT, down: INSTALLMENT_DOWN }
  const forward = installmentBehaviour.compute(instalmentValues, context(now))
  const reverse = reverseInstallmentBehaviour.compute(
    { ...instalmentValues, flat: NEIGHBOUR_FLAT_PERCENT },
    context(now),
  )

  /* products — what a +10% cost-up run must leave on the four products the lesson never opens.
   * The fifth (the rice) is left out on purpose: the learner edits its cost by hand a step
   * earlier, so checking it would be checking what they typed rather than what the run did. */
  const untouched = buildSeed(now).products.filter((p) => p.id !== SEED_PRODUCTS.rice)
  const preview = previewBulk(
    untouched,
    { kind: 'costUp', percent: BULK_COST_UP_PERCENT },
    TUTORIAL_ROUNDING_STEP,
    TUTORIAL_MONTHLY_PERCENT,
    now,
  )

  /* everyday — two calculations in the basket, totalled by the basket's own adder. */
  const rice = seedProduct(now, SEED_PRODUCTS.rice)
  const riceLine = lineOf(rice.cost, rice.margin, now)
  const oilLine = lineOf(oil.cost, oil.margin, now)
  const totals = computeBasketTotals([riceLine, oilLine])
  const combined = totals[0]
  if (combined === undefined) throw new Error('the basket totalled two calculations into nothing')

  return {
    profit: { sellingPrice: profit.price, profitAmount: profit.profitAmount },
    discount: { finalPrice: off.finalPrice, originalPrice: back.originalPrice },
    realProfit: {
      replacement: real.figures.replacement,
      realPercent: real.figures.realPercent,
      verdict: real.figures.status,
    },
    installments: {
      monthly: forward.installment,
      total: forward.total,
      reverseGainPercent: reverse.realGainPercent,
      // The bar is a cash sale — the same judgement the reverse card itself shows.
      reverseVerdict: profitStatus(reverse.realGainPercent, 0),
    },
    products: {
      costUpPercent: BULK_COST_UP_PERCENT,
      newCosts: preview.map((row) => ({ id: row.id, cost: row.newCost })),
    },
    smartRates: { seedObservationCount: buildSeed(now).observations.length },
    everyday: { combinedProfit: combined.profit },
  }
}

/** One profit calculation, as the basket would store it. */
function lineOf(cost: number, margin: number, now: number): BasketLine {
  const values = { cost, margin }
  const result = profitMode.compute(values, context(now))
  const snapshot = profitMode.snapshot(result, values)
  return { mode: 'profit', inputs: snapshot.inputs, results: snapshot.results }
}

/** Every value a lesson types in. Derived where the engine knows it, declared here where it does not. */
export function computeLessonInputs(now: number = PINNED_NOW): LessonInputs {
  const rice = seedProduct(now, SEED_PRODUCTS.rice)
  const oil = seedProduct(now, SEED_PRODUCTS.oil)
  const off = discountMode.compute({ price: DISCOUNT_PRICE, off: DISCOUNT_OFF }, context(now))
  return {
    profit: { cost: String(PROFIT_COST), margin: String(PROFIT_MARGIN), sellPrice: String(PROFIT_UNDERCUT) },
    discount: {
      original: String(DISCOUNT_PRICE),
      off: String(DISCOUNT_OFF),
      // The reverse half starts from the forward half's own answer, never from a retyped figure.
      final: String(off.finalPrice),
    },
    realProfit: {
      cost: String(oil.cost),
      price: String(oil.price),
      months: String(LENS_MONTHS_CHIP),
      knownCost: String(OIL_QUOTE),
    },
    installments: {
      cash: String(INSTALLMENT_CASH),
      count: String(INSTALLMENT_COUNT),
      flat: String(NEIGHBOUR_FLAT_PERCENT),
    },
    products: {
      cost: String(TEA_COST),
      margin: String(TEA_MARGIN),
      name: TEA_NAME,
      newCost: String(RICE_QUOTE),
      bulkPercent: String(BULK_COST_UP_PERCENT),
    },
    smartRates: { manualRate: String(MANUAL_RATE_PERCENT) },
    everyday: {
      riceCost: String(rice.cost),
      riceMargin: String(rice.margin),
      oilCost: String(oil.cost),
      oilMargin: String(oil.margin),
    },
  }
}
