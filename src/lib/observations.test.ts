/**
 * Only the pure half of `observations.ts` is exercised here: vitest runs in the `node` environment
 * with no IndexedDB backend, so every function that touches Dexie is out of reach. `staleProducts`
 * is the half that decides what the app interrupts a shopkeeper about, and it is pure by design.
 */

import { describe, expect, it } from 'vitest'
import type { Observation, Product } from './db'
import { DEFAULT_PROFILE, STALE_AGE_DAYS, STALE_CHANGE_PERCENT, staleProducts } from './observations'
import type { RateObservation } from './rates'

const NOW = Date.UTC(2026, 8, 15)
const DAY = 86_400_000

const product = (id: number, partial: Partial<Product> = {}): Product => ({
  id,
  name: `p${id}`,
  cost: 100_000,
  targetMarginPercent: 30,
  price: 130_000,
  costUpdatedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  ...partial,
})

const obs = (productId: number, daysAgo: number, partial: Partial<Observation> = {}): Observation => ({
  id: productId * 1000 + daysAgo,
  productId,
  cost: 100_000,
  observedAt: NOW - daysAgo * DAY,
  source: 'update',
  ...partial,
})

const grouped = (rows: Observation[]): Map<number, Observation[]> => {
  const out = new Map<number, Observation[]>()
  for (const o of rows) {
    const bucket = out.get(o.productId)
    if (bucket === undefined) out.set(o.productId, [o])
    else bucket.push(o)
  }
  for (const bucket of out.values()) bucket.sort((a, b) => a.observedAt - b.observedAt)
  return out
}

/** A fixed monthly percent per product; anything unlisted has no usable rate at all. */
const rateFrom =
  (percents: Record<number, number>) =>
  (productId: number): { monthlyPercent: number } | null => {
    const p = percents[productId]
    return p === undefined ? null : { monthlyPercent: p }
  }

/* The row the Dexie table stores must be usable by the engine without a conversion step. This is a
 * compile-time claim — `npx tsc --noEmit` is what actually proves it, not the assertion below. */
const asEngineRow: RateObservation = obs(1, 0, { fxAtDate: 91_000, excluded: true })

describe('Observation ↔ RateObservation', () => {
  it('is structurally assignable to the engine row, fx and exclusion included', () => {
    expect(asEngineRow.cost).toBe(100_000)
    expect(asEngineRow.fxAtDate).toBe(91_000)
    expect(asEngineRow.excluded).toBe(true)
  })
})

describe('DEFAULT_PROFILE', () => {
  it('is the neutral setup a shopkeeper gets before they are ever asked', () => {
    expect(DEFAULT_PROFILE).toEqual({ id: 'me', categories: ['other'], importDependency: 0.5 })
  })
})

describe('staleProducts', () => {
  it('leaves a recent product with a quiet rate alone', () => {
    const items = [product(1)]
    const out = staleProducts(items, grouped([obs(1, 10)]), rateFrom({ 1: 3 }), NOW)
    expect(out).toEqual([])
  })

  it('flags a product whose predicted cost has drifted past the change threshold', () => {
    const out = staleProducts([product(1)], grouped([obs(1, 30)]), rateFrom({ 1: 6 }), NOW)
    expect(out).toHaveLength(1)
    // 1.06 ^ (30 days / one average month) — a month of 6% almost exactly.
    expect(out[0]!.changePercent).toBeCloseTo(5.911, 2)
    expect(out[0]!.predictedCost).toBeCloseTo(105_911, 0)
    expect(out[0]!.ageDays).toBeCloseTo(30, 6)
  })

  it('flags a fall as readily as a rise — a cost that dropped a tenth is news too', () => {
    const out = staleProducts([product(1)], grouped([obs(1, 30)]), rateFrom({ 1: -10 }), NOW)
    expect(out).toHaveLength(1)
    expect(out[0]!.changePercent).toBeCloseTo(-9.863, 2)
    expect(out[0]!.predictedCost).toBeCloseTo(90_136.2, 1)
  })

  it('flags an old reading on age alone, however still the rate is', () => {
    const out = staleProducts([product(1)], grouped([obs(1, 100)]), rateFrom({ 1: 0 }), NOW)
    expect(out).toHaveLength(1)
    expect(out[0]!.changePercent).toBe(0)
    expect(out[0]!.ageDays).toBeCloseTo(100, 6)
    expect(out[0]!.predictedCost).toBe(100_000)
  })

  it('does not flag a reading exactly on the age threshold', () => {
    const at = staleProducts([product(1)], grouped([obs(1, STALE_AGE_DAYS)]), rateFrom({ 1: 0 }), NOW)
    expect(at).toEqual([])
    const past = staleProducts([product(1)], grouped([obs(1, STALE_AGE_DAYS + 1)]), rateFrom({ 1: 0 }), NOW)
    expect(past).toHaveLength(1)
  })

  it('has no rate to predict with, yet still asks about an ancient reading', () => {
    const noRate = () => null
    expect(staleProducts([product(1)], grouped([obs(1, 10)]), noRate, NOW)).toEqual([])
    const old = staleProducts([product(1)], grouped([obs(1, 200)]), noRate, NOW)
    expect(old).toHaveLength(1)
    // No rate is not a prediction of zero drift, so the cost reported is the one we actually know.
    expect(old[0]!.predictedCost).toBe(100_000)
    expect(old[0]!.changePercent).toBe(0)
  })

  it('measures from the newest reading, not the oldest', () => {
    const rows = [obs(1, 300, { cost: 40_000 }), obs(1, 5, { cost: 100_000 })]
    expect(staleProducts([product(1)], grouped(rows), rateFrom({ 1: 2 }), NOW)).toEqual([])
  })

  it('ignores an excluded sale price — disowning a figure is not checking the real cost', () => {
    const rows = [obs(1, 90, { cost: 100_000 }), obs(1, 2, { cost: 60_000, excluded: true })]
    const out = staleProducts([product(1)], grouped(rows), rateFrom({ 1: 0 }), NOW)
    expect(out).toHaveLength(1)
    expect(out[0]!.ageDays).toBeCloseTo(90, 6)
    // …and the excluded 60,000 never becomes the basis of the prediction.
    expect(out[0]!.predictedCost).toBe(100_000)
  })

  it('falls back to the product’s own stamped cost when it has no observations at all', () => {
    const p = product(7, { cost: 250_000, costUpdatedAt: NOW - 120 * DAY })
    const out = staleProducts([p], new Map(), rateFrom({ 7: 0 }), NOW)
    expect(out).toEqual([{ productId: 7, predictedCost: 250_000, ageDays: 120, changePercent: 0 }])
  })

  it('sorts worst-first by the size of the move, whichever way it went', () => {
    const items = [product(1), product(2), product(3), product(4)]
    const rows = [obs(1, 30), obs(2, 30), obs(3, 100), obs(4, 10)]
    const rate = rateFrom({ 1: 6, 2: -10, 3: 0, 4: 3 })
    const out = staleProducts(items, grouped(rows), rate, NOW)
    // 2 moved ~10%, 1 moved ~6%, 3 only qualified on age; 4 is quiet and recent and is absent.
    expect(out.map((c) => c.productId)).toEqual([2, 1, 3])
  })

  it('breaks a tie on the move by asking the older question first', () => {
    const items = [product(1), product(2)]
    const rows = [obs(1, 60, { cost: 100_000 }), obs(2, 200, { cost: 100_000 })]
    const out = staleProducts(items, grouped(rows), rateFrom({ 1: 0, 2: 0 }), NOW)
    expect(out.map((c) => c.productId)).toEqual([2, 1])
  })

  it('never reports a negative age for a reading dated in the future', () => {
    const rows = [obs(1, -30)]
    const out = staleProducts([product(1)], grouped(rows), rateFrom({ 1: 6 }), NOW)
    // A clock that went backwards must not invent a 6% discount; it reads as "checked just now".
    expect(out).toEqual([])
  })

  it('exposes the thresholds it judges by', () => {
    expect(STALE_CHANGE_PERCENT).toBe(5)
    expect(STALE_AGE_DAYS).toBe(45)
  })
})
