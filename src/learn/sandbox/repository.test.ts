/**
 * That the practice shop behaves like the real shop.
 *
 * Two different claims are checked here. The first is structural and costs nothing at runtime:
 * the real `lib/products` and `lib/observations` functions are assigned to `PracticeRepository`,
 * so the day someone changes a signature over there this file stops compiling — which is the
 * closest thing there is to the "same repository interface" the plan asks for while the real
 * modules are still bound to the real `db`.
 *
 * The second is behavioural: the rules that decide when a write counts as a new price reading are
 * subtle, and a sandbox that got them wrong would teach a shopkeeper a lesson that is not true of
 * their own app.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import * as realObservations from '../../lib/observations'
import * as realProducts from '../../lib/products'
import type { PracticeRepository } from './repository'
import { SEED_PRODUCTS } from './seed'
import { enterPractice, exitPractice, type PracticeSession } from './session'
import { createFakeIndexedDb, type FakeIndexedDb } from './testing/fakeIndexedDb'

const NOW = Date.UTC(2026, 8, 15, 9, 0, 0)
const MONTH_AGO = NOW - 30 * 86_400_000

/* Compile-time: the real modules satisfy the same interface the practice session hands out. */
const REAL_REPOSITORY: PracticeRepository = {
  listProducts: realProducts.listProducts,
  addProduct: realProducts.addProduct,
  updateProduct: realProducts.updateProduct,
  deleteProduct: realProducts.deleteProduct,
  bulkApply: realProducts.bulkApply,
  restoreProducts: realProducts.restoreProducts,
  addObservation: realObservations.addObservation,
  listObservations: realObservations.listObservations,
  listAllObservations: realObservations.listAllObservations,
  observationsByProduct: realObservations.observationsByProduct,
  setObservationExcluded: realObservations.setObservationExcluded,
  deleteObservationsFor: realObservations.deleteObservationsFor,
  recordCost: realObservations.recordCost,
  readStoreProfile: realObservations.readStoreProfile,
  writeStoreProfile: realObservations.writeStoreProfile,
  hasStoreProfile: realObservations.hasStoreProfile,
}

let backend: FakeIndexedDb
let session: PracticeSession
let repo: PracticeRepository

beforeEach(async () => {
  await exitPractice()
  backend = createFakeIndexedDb()
  const entered = await enterPractice({ now: NOW, indexedDB: backend.indexedDB, IDBKeyRange: backend.IDBKeyRange })
  if (!entered.ok) throw new Error('practice refused to start')
  session = entered.session
  repo = session.repository
})

describe('the practice repository', () => {
  it('offers every call the real one does, and no fewer', () => {
    expect(Object.keys(repo).sort()).toEqual(Object.keys(REAL_REPOSITORY).sort())
    for (const name of Object.keys(REAL_REPOSITORY)) {
      expect(typeof repo[name as keyof PracticeRepository]).toBe('function')
    }
  })

  it('records the first save as a reading, dated when the price was paid', async () => {
    const id = await repo.addProduct({
      name: 'چای سیاه ۵۰۰ گرمی',
      cost: 620_000,
      targetMarginPercent: 22,
      price: 760_000,
      costUpdatedAt: MONTH_AGO,
    })
    const readings = await repo.listObservations(id)
    expect(readings).toHaveLength(1)
    expect(readings[0]).toMatchObject({ cost: 620_000, observedAt: MONTH_AGO, source: 'save' })
  })

  it('only records a reading when the cost actually moved', async () => {
    const before = await repo.listObservations(SEED_PRODUCTS.oil)
    await repo.updateProduct(SEED_PRODUCTS.oil, { note: 'قفسه پایین' })
    expect(await repo.listObservations(SEED_PRODUCTS.oil)).toHaveLength(before.length)
    const product = await session.db.products.get(SEED_PRODUCTS.oil)
    await repo.updateProduct(SEED_PRODUCTS.oil, { cost: product!.cost })
    expect(await repo.listObservations(SEED_PRODUCTS.oil)).toHaveLength(before.length)
    await repo.updateProduct(SEED_PRODUCTS.oil, { cost: product!.cost + 9_000 })
    expect(await repo.listObservations(SEED_PRODUCTS.oil)).toHaveLength(before.length + 1)
  })

  it('keeps a product’s cost and its newest reading in step', async () => {
    await repo.recordCost({ productId: SEED_PRODUCTS.rice, cost: 3_480_000, observedAt: NOW, source: 'checkin' })
    const product = await session.db.products.get(SEED_PRODUCTS.rice)
    expect(product?.cost).toBe(3_480_000)
    expect(product?.costUpdatedAt).toBe(NOW)
    const readings = await repo.listObservations(SEED_PRODUCTS.rice)
    expect(readings[readings.length - 1]).toMatchObject({ cost: 3_480_000, source: 'checkin' })
  })

  it('hands back one product’s readings oldest first', async () => {
    const readings = await repo.listObservations(SEED_PRODUCTS.shampoo)
    expect(readings.map((o) => o.observedAt)).toEqual([...readings.map((o) => o.observedAt)].sort((a, b) => a - b))
    expect(readings.every((o) => o.productId === SEED_PRODUCTS.shampoo)).toBe(true)
  })

  it('takes the private history with the product when it is deleted', async () => {
    await repo.deleteProduct(SEED_PRODUCTS.notebook)
    expect(await repo.listObservations(SEED_PRODUCTS.notebook)).toEqual([])
    const all = await repo.listAllObservations()
    expect(all.some((o) => o.productId === SEED_PRODUCTS.notebook)).toBe(false)
  })

  it('writes nothing new on a retarget run, and exactly one reading per moved cost', async () => {
    const products = await repo.listProducts()
    const retarget = await repo.bulkApply(products.map((p) => ({ id: p.id, price: p.price + 1_000 })))
    expect(retarget.observationIds).toEqual([])

    const costUp = await repo.bulkApply(
      products.map((p) => ({ id: p.id, price: p.price, cost: p.cost + 1_000, costUpdatedAt: NOW })),
    )
    expect(costUp.observationIds).toHaveLength(products.length)
  })

  it('undoes a bulk run to the row it started from', async () => {
    const before = await repo.listProducts()
    const applied = await repo.bulkApply(
      before.map((p) => ({ id: p.id, price: p.price * 2, cost: p.cost + 5_000, costUpdatedAt: NOW })),
    )
    const readingsAfter = await repo.listAllObservations()
    await repo.restoreProducts(
      before.map((p) => ({ ...p })),
      applied.observationIds,
    )
    expect(await repo.listProducts()).toEqual(before)
    expect((await repo.listAllObservations()).length).toBe(readingsAfter.length - applied.observationIds.length)
  })

  it('groups every product’s readings in one pass', async () => {
    const grouped = await repo.observationsByProduct()
    expect([...grouped.keys()].sort()).toEqual(Object.values(SEED_PRODUCTS).sort())
    for (const readings of grouped.values()) {
      expect(readings.map((o) => o.observedAt)).toEqual([...readings.map((o) => o.observedAt)].sort((a, b) => a - b))
    }
  })

  it('reads and writes the practice store profile', async () => {
    expect(await repo.hasStoreProfile()).toBe(true)
    await repo.writeStoreProfile({ id: 'me', categories: ['auto'], importDependency: 1 })
    expect(await repo.readStoreProfile()).toEqual({ id: 'me', categories: ['auto'], importDependency: 1 })
  })
})

describe('the state the coach reads', () => {
  it('has the demo shop in the snapshot before the first step runs', () => {
    expect(session.snapshot().products).toHaveLength(5)
    expect(session.snapshot().profile?.categories[0]).toBe('food')
  })

  /* The refresh rule from the plan: a step whose condition is "a product now exists" is judged
   * after `refreshSandbox()`, and this is the call behind it. */
  it('does not see a write until the state is re-read, and sees it immediately after', async () => {
    const before = session.snapshot().products.length
    await repo.addProduct({
      name: 'کالای تازه',
      cost: 10_000,
      targetMarginPercent: 10,
      price: 11_000,
      costUpdatedAt: NOW,
    })
    expect(session.snapshot().products).toHaveLength(before)
    expect((await session.readState()).products).toHaveLength(before + 1)
    expect(session.snapshot().products).toHaveLength(before + 1)
  })

  it('shows a result the moment a mode produces one, with no database round trip', () => {
    session.setLastResult({
      key: 'profit',
      primaryLabel: 'سود',
      primaryValue: 140_000,
      secondaryLabel: 'درصد',
      secondaryValue: 22,
      isLoss: false,
      copyText: 'سود',
    })
    expect(session.snapshot().lastResult?.primaryValue).toBe(140_000)
    session.setLastResult(null)
    expect(session.snapshot().lastResult).toBeNull()
  })
})

describe('a session that has been left', () => {
  it('reports an empty shop rather than throwing into a render', async () => {
    const closed = session
    await exitPractice()
    await expect(closed.readState()).resolves.toEqual({
      products: [],
      observations: [],
      profile: null,
      lastResult: null,
    })
  })
})
