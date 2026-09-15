/**
 * The guard that makes «the engine decides» true rather than aspirational.
 *
 * `scripts/lesson-examples.mjs --check` says the same thing with esbuild in the loop; this says it
 * in the suite, where a maintainer changing `round2` or a margin in the demo shop will see it.
 * The last test is the important one: every challenge answer is recomputed here from the plain
 * engine functions, not from `expected.source.ts`, so a lesson that quotes the profit *amount*
 * where it meant the *price* is caught by something other than the code that produced it.
 */

import { describe, expect, it } from 'vitest'
import { computeBasketTotals } from '../../lib/basket'
import { calcDiscount, calcFromProfitPercent, calcFromSellingPrice, calcReverseDiscount } from '../../lib/calc'
import {
  monthlyRateFromPercent,
  profitStatus,
  realProfitPercent,
  replacementCost,
} from '../../lib/inflation'
import { calcInstallmentForward, calcInstallmentReverse } from '../../lib/installment'
import { previewBulk } from '../../lib/products'
import { roundUpTo } from '../../lib/rounding'
import { buildSeed, SEED_PRODUCTS } from '../sandbox/seed'
import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { computeLessonExpected, computeLessonInputs, PINNED_NOW } from './expected.source'
import { discountLesson } from './discount'
import { everydayLesson } from './everyday'
import { installmentsLesson } from './installments'
import { profitLesson } from './profit'
import { realProfitLesson } from './realProfit'
import { TUTORIAL_MONTHLY_PERCENT, TUTORIAL_ROUNDING_STEP } from './rate'
import type { Challenge, ChoiceChallenge, NumberChallenge } from './types'

const RATE = monthlyRateFromPercent(TUTORIAL_MONTHLY_PERCENT)

function numberChallenge(challenges: Challenge[], id: string): NumberChallenge {
  const found = challenges.find((c) => c.id === id)
  if (found?.kind !== 'number') throw new Error(`no number challenge ${id}`)
  return found
}

function choiceChallenge(challenges: Challenge[], id: string): ChoiceChallenge {
  const found = challenges.find((c) => c.id === id)
  if (found?.kind !== 'choice') throw new Error(`no choice challenge ${id}`)
  return found
}

function correctOption(challenge: ChoiceChallenge): string {
  const correct = challenge.options.filter((o) => o.correct)
  expect(correct).toHaveLength(1)
  return correct[0]?.id ?? ''
}

describe('the committed snapshot', () => {
  it('is what the engine says today', () => {
    expect(LESSON_EXPECTED).toEqual(computeLessonExpected())
    expect(LESSON_INPUTS).toEqual(computeLessonInputs())
  })

  it('does not move when only the clock does', () => {
    // A year on, and half a day on: nothing a challenge asks may depend on when it is taken.
    expect(computeLessonExpected(PINNED_NOW + 365 * 86_400_000)).toEqual(LESSON_EXPECTED)
    expect(computeLessonExpected(PINNED_NOW + 43_200_000)).toEqual(LESSON_EXPECTED)
    expect(computeLessonInputs(PINNED_NOW + 365 * 86_400_000)).toEqual(LESSON_INPUTS)
  })
})

describe('every challenge answer, recomputed from the engine itself', () => {
  it('mission 1 — 20% on 100,000, and what three months leaves of it', () => {
    const cost = Number(LESSON_INPUTS.mission.cost)
    const margin = Number(LESSON_INPUTS.mission.margin)
    const months = Number(LESSON_INPUTS.mission.months)

    const naive = calcFromProfitPercent(cost, margin)
    const price = roundUpTo(naive.sellingPrice, TUTORIAL_ROUNDING_STEP)
    expect(LESSON_EXPECTED.mission.sellingPrice).toBe(price)
    expect(LESSON_EXPECTED.mission.profitAmount).toBe(price - cost)

    /* The lens judges the price the shopkeeper would otherwise have charged — the 120,000, not
     * the suggestion the second calculation puts in its place. Reading the suggestion's own
     * margin back would report a healthy 20% and lose the entire point of the mission. */
    const restock = replacementCost(cost, RATE, months)
    const real = realProfitPercent(price, restock)
    expect(LESSON_EXPECTED.mission.replacement).toBe(restock)
    expect(LESSON_EXPECTED.mission.realPercent).toBe(real)
    expect(LESSON_EXPECTED.mission.verdict).toBe(profitStatus(real, margin))

    // The payoff, in one line: a fifth of the sale on paper, under a tenth once it is restocked.
    expect(real).toBeGreaterThan(0)
    expect(real).toBeLessThan(margin / 2)
    expect(LESSON_EXPECTED.mission.suggested).toBe(roundUpTo(restock * (1 + margin / 100), TUTORIAL_ROUNDING_STEP))
  })

  it('profit — 25% on 150,000, rounded the way the card rounds it', () => {
    const naive = calcFromProfitPercent(150_000, 25)
    const price = roundUpTo(naive.sellingPrice, TUTORIAL_ROUNDING_STEP)
    expect(numberChallenge(profitLesson.challenges, 'price').answer).toBe(price)
    // And the figure the lesson types in is the one the question is about.
    expect(Number(LESSON_INPUTS.profit.cost)).toBe(150_000)
  })

  it('discount — the reverse of the forward answer', () => {
    const forward = calcDiscount(500_000, 30)
    expect(Number(LESSON_INPUTS.discount.final)).toBe(forward.finalPrice)
    const back = calcReverseDiscount(forward.finalPrice, 30)
    expect(numberChallenge(discountLesson.challenges, 'original').answer).toBe(back.originalPrice)
    expect(back.originalPrice).toBe(500_000)
  })

  it('realProfit — the oil is a profit today and a loss in three months', () => {
    const oil = buildSeed(PINNED_NOW).products.find((p) => p.id === SEED_PRODUCTS.oil)
    if (oil === undefined) throw new Error('the demo shop has no oil')
    expect(Number(LESSON_INPUTS.realProfit.cost)).toBe(oil.cost)
    expect(Number(LESSON_INPUTS.realProfit.price)).toBe(oil.price)

    // Nominally in profit — otherwise the lens has nothing to reveal.
    expect(calcFromSellingPrice(oil.cost, oil.price).profitPercent).toBeGreaterThan(0)

    const months = Number(LESSON_INPUTS.realProfit.months)
    const restock = replacementCost(oil.cost, RATE, months)
    const real = realProfitPercent(oil.price, restock)
    expect(real).toBe(LESSON_EXPECTED.realProfit.realPercent)
    expect(real).toBeLessThan(0)
    // The learner is asked to pick between two verdicts; the engine picked one of them already.
    expect(correctOption(choiceChallenge(realProfitLesson.challenges, 'verdict'))).toBe('actuallyLoss')
  })

  it('installments — the instalment, and whether a flat 2% beats cash', () => {
    const cash = Number(LESSON_INPUTS.installments.cash)
    const count = Number(LESSON_INPUTS.installments.count)
    const forward = calcInstallmentForward(cash, 0, count, RATE)
    expect(numberChallenge(installmentsLesson.challenges, 'monthly').answer).toBe(forward.installment)

    const reverse = calcInstallmentReverse(cash, 0, count, Number(LESSON_INPUTS.installments.flat), RATE)
    const verdict = profitStatus(reverse.realGainPercent, 0)
    expect(verdict).toBe(LESSON_EXPECTED.installments.reverseVerdict)
    expect(correctOption(choiceChallenge(installmentsLesson.challenges, 'verdict'))).toBe(
      verdict === 'losing' ? 'worse' : 'better',
    )
  })

  it('products — a +10% cost-up run, on the rows the lesson never touches', () => {
    const untouched = buildSeed(PINNED_NOW).products.filter((p) => p.id !== SEED_PRODUCTS.rice)
    const preview = previewBulk(
      untouched,
      { kind: 'costUp', percent: Number(LESSON_INPUTS.products.bulkPercent) },
      TUTORIAL_ROUNDING_STEP,
      TUTORIAL_MONTHLY_PERCENT,
      PINNED_NOW,
    )
    expect(LESSON_EXPECTED.products.newCosts).toEqual(preview.map((row) => ({ id: row.id, cost: row.newCost })))
    expect(LESSON_EXPECTED.products.newCosts.length).toBeGreaterThan(0)
  })

  it('everyday — the two basket lines, totalled by the basket', () => {
    const seed = buildSeed(PINNED_NOW).products
    const lines = [SEED_PRODUCTS.rice, SEED_PRODUCTS.oil].map((id) => {
      const product = seed.find((p) => p.id === id)
      if (product === undefined) throw new Error(`the demo shop has no product ${id}`)
      const naive = calcFromProfitPercent(product.cost, product.targetMarginPercent)
      const price = roundUpTo(naive.sellingPrice, TUTORIAL_ROUNDING_STEP)
      return { mode: 'profit' as const, inputs: [product.cost], results: [price, price - product.cost] }
    })
    const totals = computeBasketTotals(lines)
    expect(numberChallenge(everydayLesson.challenges, 'combined').answer).toBe(totals[0]?.profit)
  })

  it('leaves the seeded reading count where the check-in challenge expects it', () => {
    expect(LESSON_EXPECTED.smartRates.seedObservationCount).toBe(buildSeed(PINNED_NOW).observations.length)
  })
})
