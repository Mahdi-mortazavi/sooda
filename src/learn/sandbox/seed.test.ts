/**
 * The demo shop, checked as data. No database is opened here: `buildSeed` is pure, and a lesson's
 * expected answer is only reproducible if this file's output is a function of `now` and nothing else.
 */

import { describe, expect, it } from 'vitest'
import { MS_PER_MONTH } from '../../lib/rates'
import { productStatus } from '../../lib/products'
import { usableObservations } from '../../lib/rates'
import { buildSeed, SEED_NAME_KEYS, SEED_PRODUCTS, SEED_PROFILE, SEED_TEXT_KEYS } from './seed'

/** A fixed instant to date everything from: 1405-06-24, the day v1.5 was planned. */
const NOW = Date.UTC(2026, 8, 15, 9, 0, 0)

/** The rate every lesson pins, independent of `rates.json` (see "the tutorial rate" in the plan). */
const TUTORIAL_MONTHLY_PERCENT = 3

describe('the demo shop', () => {
  it('is the same shop every time it is built', () => {
    expect(buildSeed(NOW)).toEqual(buildSeed(NOW))
    // …and a different `now` moves every date by exactly that much, changing nothing else.
    const later = buildSeed(NOW + MS_PER_MONTH)
    expect(later.products.map((p) => p.name)).toEqual(buildSeed(NOW).products.map((p) => p.name))
    expect(later.products.map((p) => p.cost)).toEqual(buildSeed(NOW).products.map((p) => p.cost))
  })

  it('hands back a fresh profile, so a lesson editing it cannot poison the next run', () => {
    const seed = buildSeed(NOW)
    seed.profile.categories.push('auto')
    expect(buildSeed(NOW).profile).toEqual(SEED_PROFILE)
    expect(SEED_PROFILE.categories).toEqual(['food', 'digital', 'beauty', 'stationery'])
  })

  it('stocks five products with Persian names and toman prices', () => {
    const { products } = buildSeed(NOW)
    expect(products.map((p) => p.id)).toEqual([1, 2, 3, 4, 5])
    expect(Object.values(SEED_PRODUCTS).sort()).toEqual(products.map((p) => p.id))
    for (const product of products) {
      expect(product.name).toMatch(/[؀-ۿ]/)
      expect(product.unit).toBe('toman')
      expect(product.cost).toBeGreaterThan(0)
      expect(product.price).toBeGreaterThan(0)
      expect(product.category).toBeTruthy()
    }
  })

  /* `category` is what the national price-rise figure is looked up by, so a miscategorised row
   * makes the smartRates lesson explain a product with the wrong index — confidently. */
  it('files every product under the division a shopkeeper would file it under', () => {
    const { products } = buildSeed(NOW)
    const byId = new Map(products.map((p) => [p.id, p.category]))
    expect(byId.get(SEED_PRODUCTS.rice)).toBe('food')
    expect(byId.get(SEED_PRODUCTS.oil)).toBe('food')
    expect(byId.get(SEED_PRODUCTS.shampoo)).toBe('beauty')
    expect(byId.get(SEED_PRODUCTS.notebook)).toBe('stationery')
    // Batteries are communication/recreation equipment, not kitchenware.
    expect(byId.get(SEED_PRODUCTS.battery)).toBe('digital')
    // Every category the shop stocks is one the profile claims, or the estimate falls back.
    for (const product of products) {
      expect(SEED_PROFILE.categories).toContain(product.category)
    }
  })

  /* The realProfit lesson teaches that a thin margin is where profit disappears first. It cannot
   * teach it on a shop whose staples carry a stationer's markup. */
  it('keeps staple margins thin and discretionary margins fat', () => {
    const byId = new Map(buildSeed(NOW).products.map((p) => [p.id, p.targetMarginPercent]))
    expect(byId.get(SEED_PRODUCTS.rice)).toBeLessThanOrEqual(15)
    // Cooking oil is price-regulated: single digits is what a shopkeeper really gets.
    expect(byId.get(SEED_PRODUCTS.oil)).toBeLessThan(10)
    expect(byId.get(SEED_PRODUCTS.notebook)).toBeGreaterThanOrEqual(30)
    expect(byId.get(SEED_PRODUCTS.shampoo)).toBeGreaterThanOrEqual(30)
  })

  it('prices the staples where a shopkeeper would recognise them', () => {
    const byId = new Map(buildSeed(NOW).products.map((p) => [p.id, p]))
    // Per kilo, from the 10 kg sack — the first figure a learner sees, and the one that costs
    // trust if it is wrong.
    const ricePerKilo = byId.get(SEED_PRODUCTS.rice)!.cost / 10
    expect(ricePerKilo).toBeGreaterThan(180_000)
    expect(ricePerKilo).toBeLessThan(280_000)
    const oil = byId.get(SEED_PRODUCTS.oil)!
    expect(oil.price).toBeGreaterThan(90_000)
    expect(oil.price).toBeLessThan(140_000)
  })

  it('gives every product a history the estimator can actually learn from', () => {
    const { products, observations } = buildSeed(NOW)
    for (const product of products) {
      const mine = observations.filter((o) => o.productId === product.id)
      expect(mine.length).toBeGreaterThanOrEqual(2)
      // Every reading is in the past, and the newest is the one stamped on the product.
      for (const o of mine) expect(o.observedAt).toBeLessThan(NOW)
      const newest = mine[mine.length - 1]!
      expect(product.cost).toBe(newest.cost)
      expect(product.costUpdatedAt).toBe(newest.observedAt)
      expect(product.createdAt).toBe(mine[0]!.observedAt)
    }
    // Spread over months, not minutes: the oldest reading is half a year back.
    const oldest = Math.min(...observations.map((o) => o.observedAt))
    expect((NOW - oldest) / MS_PER_MONTH).toBeCloseTo(6, 6)
  })

  it('carries exactly one disowned sale price, which the estimator ignores', () => {
    const { observations } = buildSeed(NOW)
    const excluded = observations.filter((o) => o.excluded === true)
    expect(excluded).toHaveLength(1)
    expect(excluded[0]!.productId).toBe(SEED_PRODUCTS.shampoo)
    const shampoo = observations.filter((o) => o.productId === SEED_PRODUCTS.shampoo)
    expect(usableObservations(shampoo)).toHaveLength(shampoo.length - 1)
  })

  it('numbers its observations from 1 with no gaps, so Dexie carries on from 6', () => {
    const { observations } = buildSeed(NOW)
    expect(observations.map((o) => o.id)).toEqual(observations.map((_, i) => i + 1))
  })

  it('translates every name and note through i18n, and defaults to the Persian', () => {
    const shouty = buildSeed(NOW, (key) => key.toUpperCase())
    expect(shouty.products.map((p) => p.name)).toEqual([
      'LEARN.SANDBOX.PRODUCTS.RICE',
      'LEARN.SANDBOX.PRODUCTS.OIL',
      'LEARN.SANDBOX.PRODUCTS.SHAMPOO',
      'LEARN.SANDBOX.PRODUCTS.NOTEBOOK',
      'LEARN.SANDBOX.PRODUCTS.BATTERY',
    ])
    const noted = shouty.products.find((p) => p.note !== undefined)
    expect(noted?.note).toBe('LEARN.SANDBOX.NOTES.STALEPRICE')
    // A translator that has no string for a key gets the Persian back, never an empty row.
    expect(buildSeed(NOW, (_key, fallback) => fallback).products).toEqual(buildSeed(NOW).products)
  })

  it('changes not one figure when the language does', () => {
    const fa = buildSeed(NOW)
    const en = buildSeed(NOW, (key) => key)
    expect(en.observations).toEqual(fa.observations)
    expect(en.products.map(({ name, note, ...figures }) => figures)).toEqual(
      fa.products.map(({ name, note, ...figures }) => figures),
    )
  })

  it('announces every key it uses, so `copy` has the whole list', () => {
    const used = new Set<string>()
    for (const product of buildSeed(NOW, (key) => key).products) {
      used.add(product.name)
      if (product.note !== undefined) used.add(product.note)
    }
    expect([...used].sort()).toEqual([...SEED_TEXT_KEYS].sort())
    expect(Object.entries(SEED_NAME_KEYS).map(([id]) => Number(id)).sort()).toEqual(
      Object.values(SEED_PRODUCTS).sort(),
    )
  })

  it('leaves the rice losing money, which is the whole point of the first lesson', () => {
    const { products } = buildSeed(NOW)
    const rice = products.find((p) => p.id === SEED_PRODUCTS.rice)!
    const status = productStatus(rice, TUTORIAL_MONTHLY_PERCENT, NOW)
    expect(status.realMarginPercent).toBeLessThan(rice.targetMarginPercent)
    expect(status.health).not.toBe('healthy')
  })

  it('leaves the rest of the shelf healthy, so the losing row stands out', () => {
    const { products } = buildSeed(NOW)
    for (const product of products) {
      if (product.id === SEED_PRODUCTS.rice) continue
      const status = productStatus(product, TUTORIAL_MONTHLY_PERCENT, NOW)
      expect(status.realMarginPercent).toBeGreaterThan(0)
    }
  })
})
