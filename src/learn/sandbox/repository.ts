/**
 * The practice shop's repository: the same calls `src/lib/products.ts` and
 * `src/lib/observations.ts` expose, bound to the practice database instead of the real one.
 *
 * Every function here is a deliberate mirror of its counterpart, down to the transaction it opens
 * and the rule about which writes count as a new reading — a sandbox that recorded observations
 * differently from the app would teach the wrong lesson, which is the whole point of D1. The
 * counterparts' types are imported (and only their types), so a signature change over there is a
 * compile error over here rather than a lesson that silently drifts out of step.
 */

import Dexie from 'dexie'
import type { Observation, ObservationSource, Product, StoreProfile } from '../../lib/db'
import type { BulkApplyResult, ProductChange } from '../../lib/products'
import type { PracticeDb } from './db'
import { SEED_PROFILE } from './seed'

/** What a lesson — and any component a lesson drives — may do to the practice shop. */
export interface PracticeRepository {
  listProducts(): Promise<Product[]>
  addProduct(p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>
  updateProduct(id: number, patch: Partial<Omit<Product, 'id'>>): Promise<void>
  deleteProduct(id: number): Promise<void>
  bulkApply(changes: ProductChange[]): Promise<BulkApplyResult>
  restoreProducts(snapshot: Product[], observationIds?: number[]): Promise<void>
  addObservation(o: Omit<Observation, 'id'>): Promise<number>
  listObservations(productId: number): Promise<Observation[]>
  listAllObservations(): Promise<Observation[]>
  observationsByProduct(): Promise<Map<number, Observation[]>>
  setObservationExcluded(id: number, excluded: boolean): Promise<void>
  deleteObservationsFor(productId: number): Promise<void>
  recordCost(args: {
    productId: number
    cost: number
    observedAt: number
    fxAtDate?: number
    source: ObservationSource
  }): Promise<void>
  readStoreProfile(): Promise<StoreProfile>
  writeStoreProfile(p: StoreProfile): Promise<void>
  hasStoreProfile(): Promise<boolean>
}

/**
 * `clock` is the session's clock, not `Date.now`. A lesson that asks "what does this cost you
 * today?" has to get the same answer every time it is taken, so a practice session pins the
 * instant it started and stamps every write with it.
 */
export function createPracticeRepository(db: PracticeDb, clock: () => number): PracticeRepository {
  return {
    async listProducts(): Promise<Product[]> {
      return db.products.toArray()
    },

    async addProduct(p): Promise<number> {
      const now = clock()
      return db.transaction('rw', db.products, db.observations, async () => {
        const id = await db.products.add({ ...p, createdAt: now, updatedAt: now })
        // The very first save is already evidence, dated when the price was paid.
        const first = { productId: id, cost: p.cost, observedAt: p.costUpdatedAt, source: 'save' as const }
        await db.observations.add(first as Observation)
        return id
      })
    },

    async updateProduct(id, patch): Promise<void> {
      const now = clock()
      await db.transaction('rw', db.products, db.observations, async () => {
        const before = await db.products.get(id)
        await db.products.update(id, { ...patch, updatedAt: now })
        // Only a cost that actually MOVED is a new reading — same rule the real repository keeps.
        if (before === undefined || patch.cost === undefined || patch.cost === before.cost) return
        await db.observations.add({
          productId: id,
          cost: patch.cost,
          observedAt: patch.costUpdatedAt ?? now,
          source: 'update',
        } as Observation)
      })
    },

    async deleteProduct(id): Promise<void> {
      await db.transaction('rw', db.products, db.observations, async () => {
        await db.products.delete(id)
        await db.observations.where('productId').equals(id).delete()
      })
    },

    async bulkApply(changes): Promise<BulkApplyResult> {
      const now = clock()
      return db.transaction('rw', db.products, db.observations, async () => {
        const observationIds: number[] = []
        for (const c of changes) {
          const before = await db.products.get(c.id)
          await db.products.update(c.id, {
            price: c.price,
            updatedAt: now,
            ...(c.cost === undefined ? {} : { cost: c.cost }),
            ...(c.costUpdatedAt === undefined ? {} : { costUpdatedAt: c.costUpdatedAt }),
          })
          if (before === undefined || c.cost === undefined || c.cost === before.cost) continue
          const id = await db.observations.add({
            productId: c.id,
            cost: c.cost,
            observedAt: c.costUpdatedAt ?? now,
            source: 'update',
          } as Observation)
          observationIds.push(id)
        }
        return { observationIds }
      })
    },

    async restoreProducts(snapshot, observationIds = []): Promise<void> {
      await db.transaction('rw', db.products, db.observations, async () => {
        await db.products.bulkPut(snapshot)
        if (observationIds.length > 0) await db.observations.bulkDelete(observationIds)
      })
    },

    async addObservation(o): Promise<number> {
      return db.observations.add(o as Observation)
    },

    async listObservations(productId): Promise<Observation[]> {
      // The compound index hands these back already ordered, exactly as the real reader does.
      return db.observations
        .where('[productId+observedAt]')
        .between([productId, Dexie.minKey], [productId, Dexie.maxKey])
        .toArray()
    },

    async listAllObservations(): Promise<Observation[]> {
      return db.observations.toArray()
    },

    async observationsByProduct(): Promise<Map<number, Observation[]>> {
      const all = await db.observations.toArray()
      const out = new Map<number, Observation[]>()
      for (const o of all) {
        const bucket = out.get(o.productId)
        if (bucket === undefined) out.set(o.productId, [o])
        else bucket.push(o)
      }
      for (const bucket of out.values()) bucket.sort((a, b) => a.observedAt - b.observedAt)
      return out
    },

    async setObservationExcluded(id, excluded): Promise<void> {
      await db.observations.update(id, { excluded })
    },

    async deleteObservationsFor(productId): Promise<void> {
      await db.observations.where('productId').equals(productId).delete()
    },

    async recordCost(args): Promise<void> {
      const { productId, cost, observedAt, fxAtDate, source } = args
      await db.transaction('rw', db.products, db.observations, async () => {
        await db.observations.add({
          productId,
          cost,
          observedAt,
          ...(fxAtDate === undefined ? {} : { fxAtDate }),
          source,
        } as Observation)
        // The reading and the product's own cost must never disagree.
        await db.products.update(productId, { cost, costUpdatedAt: observedAt, updatedAt: clock() })
      })
    },

    async readStoreProfile(): Promise<StoreProfile> {
      const stored = await db.storeProfile.get('me')
      /* The demo shop's own profile is the fallback, not the app's neutral default: a practice
       * database that somehow lost its profile should still look like the shop in the lesson. */
      return stored ?? { ...SEED_PROFILE, categories: [...SEED_PROFILE.categories] }
    },

    async writeStoreProfile(p): Promise<void> {
      await db.storeProfile.put({ ...p, id: 'me' })
    },

    async hasStoreProfile(): Promise<boolean> {
      return (await db.storeProfile.get('me')) !== undefined
    },
  }
}
