import { describe, expect, it } from 'vitest'
import { computeCheckIn, type CheckInSource } from './checkin'
import { DEFAULT_PROFILE } from './observations'
import type { Observation, Product, StoreProfile } from './db'
import type { RatesFile } from './rates/schema'

/**
 * `computeCheckIn` used to read the module-level database, which made it both untestable and —
 * once practice mode arrived — a way for a tutorial to ask the shopkeeper about their own shop.
 * It now takes its four reads and its clock. These tests hold that door shut.
 */

const MS_PER_DAY = 86_400_000
/** A fixed instant, so nothing here drifts with the wall clock. */
const NOW = Date.UTC(2026, 8, 15)

const rates: RatesFile = {
  schema: 1,
  updatedAt: '2026-09-10',
  cpi: {
    source: { name: 'Statistical Center of Iran', url: 'https://www.amar.org.ir/' },
    asOf: '2026-08',
    confidence: 'secondary',
    overallMonthlyPercent: 3.4,
    categories: { food: 3.6 },
  },
  fx: { source: { name: 'Example', url: 'https://example.com' }, pair: 'USD/IRT', series: [] },
}

const product = (id: number, over: Partial<Product> = {}): Product => ({
  id,
  name: `p${id}`,
  cost: 100_000,
  targetMarginPercent: 20,
  price: 120_000,
  costUpdatedAt: NOW - 120 * MS_PER_DAY,
  createdAt: NOW - 180 * MS_PER_DAY,
  updatedAt: NOW - 120 * MS_PER_DAY,
  ...over,
})

/** A source that answers from the arrays it is given, and counts how often it was asked. */
function sourceOf(products: Product[], byProduct = new Map<number, Observation[]>(), profile: StoreProfile = DEFAULT_PROFILE) {
  const calls = { listProducts: 0, observationsByProduct: 0, readStoreProfile: 0, hasStoreProfile: 0 }
  const source: CheckInSource = {
    listProducts: async () => ((calls.listProducts += 1), products),
    observationsByProduct: async () => ((calls.observationsByProduct += 1), byProduct),
    readStoreProfile: async () => ((calls.readStoreProfile += 1), profile),
    hasStoreProfile: async () => ((calls.hasStoreProfile += 1), true),
  }
  return { source, calls }
}

describe('computeCheckIn', () => {
  it('reads the shop it was handed, and reads each thing exactly once', async () => {
    const { source, calls } = sourceOf([product(1), product(2)])
    const snapshot = await computeCheckIn(rates, source, () => NOW)

    expect(snapshot.productCount).toBe(2)
    expect(calls).toEqual({ listProducts: 1, observationsByProduct: 1, readStoreProfile: 1, hasStoreProfile: 1 })
  })

  it('pins every estimate to the clock it was given, not to the wall clock', async () => {
    const { source } = sourceOf([product(1)])
    const snapshot = await computeCheckIn(rates, source, () => NOW)

    expect(snapshot.now).toBe(NOW)
  })

  it('asks about a product whose cost is four months old', async () => {
    const { source } = sourceOf([product(1)])
    const snapshot = await computeCheckIn(rates, source, () => NOW)

    expect(snapshot.items.map((i) => i.product.id)).toEqual([1])
    // Four months at the bundled 3.4%/month: the prediction has to be above what was paid.
    expect(snapshot.items[0]!.predictedCost).toBeGreaterThan(100_000)
  })

  it('leaves a freshly-priced product alone', async () => {
    const { source } = sourceOf([product(1, { costUpdatedAt: NOW - MS_PER_DAY })])
    const snapshot = await computeCheckIn(rates, source, () => NOW)

    expect(snapshot.items).toEqual([])
    expect(snapshot.productCount).toBe(1)
  })

  it('prefers a recorded reading over the product’s own stamped cost', async () => {
    const byProduct = new Map<number, Observation[]>([
      [1, [{ id: 1, productId: 1, cost: 180_000, observedAt: NOW - 120 * MS_PER_DAY, source: 'update' }]],
    ])
    const { source } = sourceOf([product(1)], byProduct)
    const snapshot = await computeCheckIn(rates, source, () => NOW)

    // Predicted from 180,000 rather than the 100,000 stamped on the row.
    expect(snapshot.items[0]!.predictedCost).toBeGreaterThan(180_000)
  })

  it('reports that setup was never answered without inventing a profile', async () => {
    const { source } = sourceOf([product(1)])
    const never: CheckInSource = { ...source, hasStoreProfile: async () => false }
    const snapshot = await computeCheckIn(rates, never, () => NOW)

    expect(snapshot.hasProfile).toBe(false)
    expect(snapshot.profile).toEqual(DEFAULT_PROFILE)
  })

  it('is deterministic: the same shop and the same instant give the same answer twice', async () => {
    const shop = [product(1), product(2, { costUpdatedAt: NOW - 200 * MS_PER_DAY })]
    const a = await computeCheckIn(rates, sourceOf(shop).source, () => NOW)
    const b = await computeCheckIn(rates, sourceOf(shop).source, () => NOW)

    expect(a.items.map((i) => [i.product.id, i.predictedCost])).toEqual(b.items.map((i) => [i.product.id, i.predictedCost]))
  })
})
