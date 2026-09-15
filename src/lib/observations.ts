/**
 * Per-product price observations: the private history that makes Sooda's estimates get better the
 * more a shopkeeper uses it. Nothing here leaves the device.
 */

import Dexie from 'dexie'
import { db, type Observation, type ObservationSource, type Product, type StoreProfile } from './db'
import { MS_PER_MONTH } from './rates'

/* ── observations ───────────────────────────────────────────────────────── */

/** Adds one reading. Returns the new id, so an undoable bulk run can name exactly what it wrote. */
export async function addObservation(o: Omit<Observation, 'id'>): Promise<number> {
  return db.observations.add(o as Observation)
}

/** One product's readings, oldest first. */
export async function listObservations(productId: number): Promise<Observation[]> {
  /* The [productId+observedAt] index hands these back already ordered, so the estimator never
   * pays for an in-memory sort on the hot path. */
  return db.observations
    .where('[productId+observedAt]')
    .between([productId, Dexie.minKey], [productId, Dexie.maxKey])
    .toArray()
}

export async function listAllObservations(): Promise<Observation[]> {
  return db.observations.toArray()
}

/** Marks a reading as a one-off (or un-marks it). The row is kept either way — the user may be wrong. */
export async function setObservationExcluded(id: number, excluded: boolean): Promise<void> {
  await db.observations.update(id, { excluded })
}

export async function deleteObservationsFor(productId: number): Promise<void> {
  await db.observations.where('productId').equals(productId).delete()
}

/** One query, then grouped in memory — the products list needs every product's history at once. */
export async function observationsByProduct(): Promise<Map<number, Observation[]>> {
  const all = await db.observations.toArray()
  const out = new Map<number, Observation[]>()
  for (const o of all) {
    const bucket = out.get(o.productId)
    if (bucket === undefined) out.set(o.productId, [o])
    else bucket.push(o)
  }
  // A single full-table read cannot use the compound index, so each bucket is ordered here instead.
  for (const bucket of out.values()) bucket.sort((a, b) => a.observedAt - b.observedAt)
  return out
}

/** Records a cost and stamps the product, in one transaction. Used by save, update, calc and check-in. */
export async function recordCost(args: {
  productId: number
  cost: number
  observedAt: number
  fxAtDate?: number
  source: ObservationSource
}): Promise<void> {
  const { productId, cost, observedAt, fxAtDate, source } = args
  await db.transaction('rw', db.products, db.observations, async () => {
    await db.observations.add({
      productId,
      cost,
      observedAt,
      ...(fxAtDate === undefined ? {} : { fxAtDate }),
      source,
    } as Observation)
    /* The reading and the product's own `cost` must never disagree: a reader that trusted one and
     * not the other would show two different "today's cost" figures on the same screen. */
    await db.products.update(productId, { cost, costUpdatedAt: observedAt, updatedAt: Date.now() })
  })
}

/* ── the single-row store profile ───────────────────────────────────────── */

export const DEFAULT_PROFILE: StoreProfile = { id: 'me', categories: ['other'], importDependency: 0.5 }

/** The user's store setup, or a neutral default when they have not been asked yet. */
export async function readStoreProfile(): Promise<StoreProfile> {
  const stored = await db.storeProfile.get('me')
  // A fresh copy every time: callers edit what they are handed, and the default is module state.
  return stored ?? { ...DEFAULT_PROFILE, categories: [...DEFAULT_PROFILE.categories] }
}

export async function writeStoreProfile(p: StoreProfile): Promise<void> {
  await db.storeProfile.put({ ...p, id: 'me' })
}

/** Whether the user has actually been through setup — `readStoreProfile` cannot tell you, it defaults. */
export async function hasStoreProfile(): Promise<boolean> {
  return (await db.storeProfile.get('me')) !== undefined
}

/* ── pure helpers (no `db` access — unit-testable in the node environment) ─ */

/** A predicted move this big is worth interrupting the user for. */
export const STALE_CHANGE_PERCENT = 5

/** …and so is a reading this old, however quiet the rate looks. */
export const STALE_AGE_DAYS = 45

const MS_PER_DAY = 86_400_000

export interface StaleCandidate {
  productId: number
  predictedCost: number
  ageDays: number
  changePercent: number
}

/**
 * Pure: which products are worth asking about. A product qualifies when its predicted cost has
 * drifted by `STALE_CHANGE_PERCENT` or more since its last reading, OR when that reading is older
 * than `STALE_AGE_DAYS` — a quiet category still needs checking eventually.
 *
 * Worst-first, by the size of the predicted move (either direction: a cost that fell by a tenth is
 * as much news as one that rose). Ties break on age, so the older question gets asked first.
 */
export function staleProducts(
  products: Product[],
  byProduct: Map<number, Observation[]>,
  rate: (productId: number) => { monthlyPercent: number } | null,
  now: number,
): StaleCandidate[] {
  const out: StaleCandidate[] = []
  for (const p of products) {
    /* Excluded rows are sale prices the user disowned, so they are not evidence that the true cost
     * was checked. A product with no usable reading falls back to its own stamped cost, which is
     * exactly what the v3 → v4 backfill would have written for it. */
    const usable = (byProduct.get(p.id) ?? []).filter((o) => o.excluded !== true)
    const last = usable.length > 0 ? usable[usable.length - 1]! : { cost: p.cost, observedAt: p.costUpdatedAt }
    const ageMs = Math.max(0, now - last.observedAt)
    const ageDays = ageMs / MS_PER_DAY
    const monthlyPercent = rate(p.id)?.monthlyPercent ?? null
    /* No rate means no prediction — not a prediction of zero drift. Such a product can still be
     * asked about on age alone, and is reported with the cost we actually know. */
    const growth = monthlyPercent === null ? 1 : Math.pow(1 + monthlyPercent / 100, ageMs / MS_PER_MONTH)
    const predictedCost = last.cost * growth
    const changePercent = (growth - 1) * 100
    if (Math.abs(changePercent) < STALE_CHANGE_PERCENT && ageDays <= STALE_AGE_DAYS) continue
    out.push({ productId: p.id, predictedCost, ageDays, changePercent })
  }
  out.sort((a, b) => {
    const d = Math.abs(b.changePercent) - Math.abs(a.changePercent)
    return d !== 0 ? d : b.ageDays - a.ageDays
  })
  return out
}
