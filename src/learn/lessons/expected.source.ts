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

import { monthlyRateFromPercent, profitStatus, replacementCost } from '../../lib/inflation'
import { computeBasketTotals, type BasketLine } from '../../lib/basket'
import { discountMode } from '../../lib/modes/discount'
import { installmentBehaviour } from '../../lib/modes/installment'
import { profitMode } from '../../lib/modes/profit'
import { reverseDiscountMode } from '../../lib/modes/rdiscount'
import { reverseInstallmentBehaviour } from '../../lib/modes/rinstallment'
import { sellMode } from '../../lib/modes/sell'
import type { CalcContext, ModeState } from '../../lib/modes/types'
import { previewBulk } from '../../lib/products'
import { MS_PER_MONTH } from '../../lib/rates'
import { roundUpTo } from '../../lib/rounding'
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
/** A 500,000 price tag at 30% off. Lesson 2 works it forward, then works its own answer back. */
const DISCOUNT_PRICE = 500_000
const DISCOUNT_OFF = 30
/**
 * A different sale for lesson 2's challenge: 360,000 on the sign, 20% already taken off.
 *
 * The lesson's own numbers are no use as a question. It states «قیمت اصلی ۵۰۰٬۰۰۰ و تخفیف ۳۰
 * درصد» in its first tooltip and then puts 500,000 back on the screen at the last step, so a
 * challenge that asked for the original price of the 350,000 rug was marking recall. These two
 * are a sale the learner has not been handed the answer to, and 20% off is not the 30% the
 * lesson drilled — the reverse has to be done, not remembered.
 */
const CHALLENGE_FINAL = 360_000
const CHALLENGE_OFF = 20
/** A 12,000,000 sale over six months, nothing down, against a neighbour's flat 2%/month. */
const INSTALLMENT_CASH = 12_000_000
const INSTALLMENT_COUNT = 6
const INSTALLMENT_DOWN = 0
const NEIGHBOUR_FLAT_PERCENT = 2
/** Mission 1: the tin of tuna at a round 100,000, and the 20% every shopkeeper asks for first. */
const MISSION_COST = 100_000
const MISSION_MARGIN = 20
/** Undercutting his own cost by 10,000 — lesson 1's last step, where the card turns red. */
const PROFIT_UNDERCUT = 140_000
/** The lens horizon lesson 3 asks for, in months. */
const LENS_MONTHS_CHIP = 3
/**
 * The horizon lesson 3's challenge asks about — deliberately not the one the lesson ran.
 *
 * Three months is on the card when the question appears, twice over: once from the estimate and
 * once from the supplier's own quote. One month is a sale the learner has to think about, and it
 * is where the same oil changes its answer — which is the lesson's actual claim, that how long
 * the money is out is what decides whether the sale was worth making.
 */
const CHALLENGE_LENS_MONTHS = 1
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
/**
 * Which product lesson 6's check-in demo types a price for.
 *
 * The check-in offers the notebook first and the oil second, on every clock — the order is the
 * seed's, not the wall clock's, because `staleProducts` ranks by how far a price has probably
 * moved and the seed fixes both the readings and their ages. `lessons.test.ts` pins that order,
 * so a change to the demo shop that reshuffles it fails there rather than in front of a learner.
 */
const CHECKIN_PRODUCT = SEED_PRODUCTS.notebook
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

  /* discount — the sale the lesson works forward, and the different one its challenge works
   * back. Both go through the app's own two directions, so neither can drift from the screen. */
  const off = discountMode.compute({ price: DISCOUNT_PRICE, off: DISCOUNT_OFF }, context(now))
  const back = reverseDiscountMode.compute({ final: CHALLENGE_FINAL, off: CHALLENGE_OFF }, context(now))

  /* realProfit — the demo shop's oil. It is the one row that reads as a perfectly ordinary
   * profit today (single digits, but a profit) and is a loss three months out, which is the
   * whole lesson. The rice is already losing before the lens is touched, so it would have
   * nothing left to reveal. */
  const oil = seedProduct(now, SEED_PRODUCTS.oil)
  const real = sellMode.compute({ cost: oil.cost, price: oil.price }, context(now, { months: String(LENS_MONTHS_CHIP) }))
  /* The same row at the horizon the challenge asks about. Run through the same mode rather than
   * reasoned about: "a shorter wait must be better" is an argument, and an argument is what the
   * learner is supposed to make — the marking has to come from the engine. */
  const realSooner = sellMode.compute(
    { cost: oil.cost, price: oil.price },
    context(now, { months: String(CHALLENGE_LENS_MONTHS) }),
  )

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

  /* mission — the same calculation twice: once as anyone would do it, once through the lens.
   * The lens judges the price the shopkeeper would otherwise have charged, which is why the
   * real percentage below belongs to the 120,000 of the first run and not to the suggestion. */
  const missionValues = { cost: MISSION_COST, margin: MISSION_MARGIN }
  const missionNow = profitMode.compute(missionValues, context(now))
  const missionLater = profitMode.compute(missionValues, context(now, { months: String(LENS_MONTHS_CHIP) }))

  /* everyday — two calculations in the basket, totalled by the basket's own adder. */
  const rice = seedProduct(now, SEED_PRODUCTS.rice)
  const riceLine = lineOf(rice.cost, rice.margin, now)
  const oilLine = lineOf(oil.cost, oil.margin, now)
  const totals = computeBasketTotals([riceLine, oilLine])
  const combined = totals[0]
  if (combined === undefined) throw new Error('the basket totalled two calculations into nothing')

  return {
    profit: { sellingPrice: profit.price, profitAmount: profit.profitAmount },
    discount: {
      finalPrice: off.finalPrice,
      challenge: { finalPrice: CHALLENGE_FINAL, offPercent: CHALLENGE_OFF, originalPrice: back.originalPrice },
    },
    realProfit: {
      replacement: real.figures.replacement,
      realPercent: real.figures.realPercent,
      verdict: real.figures.status,
      challenge: {
        months: CHALLENGE_LENS_MONTHS,
        replacement: realSooner.figures.replacement,
        realPercent: realSooner.figures.realPercent,
        verdict: realSooner.figures.status,
      },
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
    mission: {
      sellingPrice: missionNow.price,
      profitAmount: missionNow.profitAmount,
      replacement: missionLater.figures.replacement,
      realPercent: missionLater.figures.realPercent,
      verdict: missionLater.figures.status,
      suggested: missionLater.price,
    },
    everyday: { combinedProfit: combined.profit },
  }
}

/**
 * What lesson 6's check-in demo types for the first product it is offered.
 *
 * Never a literal. The sheet shows the learner what it thinks the notebook costs today — around
 * 85,800 against the 78,000 last written down — so a demo that typed a figure of its own would be
 * putting a number on screen that the card beside it disagrees with. This carries the product's
 * own last reading forward at the pinned tutorial rate, over its own age, and rounds it the way
 * every price in the practice shop is rounded.
 *
 * Pinned rather than taken from `computeCheckIn`'s prediction on purpose: that prediction blends
 * the national CPI file, so a maintainer running `npm run rates:update` would silently change
 * what the ghost finger types. It stays inside the sheet's own outlier window either way — the
 * dialog would stop the demo dead, and it is the one thing on this screen the finger cannot
 * dismiss.
 */
function checkInCost(now: number): number {
  const readings = buildSeed(now).observations.filter(
    (o) => o.productId === CHECKIN_PRODUCT && o.excluded !== true,
  )
  const last = readings[readings.length - 1]
  if (last === undefined) throw new Error(`the demo shop has no reading for product ${CHECKIN_PRODUCT}`)
  const ageMonths = (now - last.observedAt) / MS_PER_MONTH
  const rate = monthlyRateFromPercent(TUTORIAL_MONTHLY_PERCENT)
  return roundUpTo(replacementCost(last.cost, rate, ageMonths), TUTORIAL_ROUNDING_STEP)
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
    smartRates: { manualRate: String(MANUAL_RATE_PERCENT), checkInCost: String(checkInCost(now)) },
    mission: {
      cost: String(MISSION_COST),
      margin: String(MISSION_MARGIN),
      months: String(LENS_MONTHS_CHIP),
    },
    everyday: {
      riceCost: String(rice.cost),
      riceMargin: String(rice.margin),
      oilCost: String(oil.cost),
      oilMargin: String(oil.margin),
    },
  }
}
