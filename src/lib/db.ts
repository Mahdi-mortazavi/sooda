import Dexie, { type EntityTable } from 'dexie'
import type { Mode } from './calc'
import type { CategoryId, ImportDependency } from './rates/categories'
import type { Unit } from './units'

/**
 * Extra figures a v1.3 mode needs to be re-read later (inflation horizon, instalment plan…).
 * Every field is optional: rows written by v1.2 have no `meta` at all and must stay readable.
 */
export interface EntryMeta {
  months?: number
  annualInflationPercent?: number
  replacementCost?: number
  installmentCount?: number
  downPayment?: number
  flatMonthlyPercent?: number
}

export interface HistoryEntry {
  id: number
  mode: Mode
  /* Widened from the v1.2 `[number, number]` because instalment modes carry more than two
   * figures. Old two-element rows are still exactly valid data — no migration is needed. */
  /** Inputs as entered (already parsed to numbers) */
  inputs: number[]
  /** Results in display order */
  results: number[]
  /** Currency/unit preset active when the calculation was made (absent = none). */
  unit?: Unit
  meta?: EntryMeta
  createdAt: number
}

/** One calculation added to the basket for summing. Same shape as history entries. */
export interface BasketItem {
  id: number
  mode: Mode
  inputs: number[]
  results: number[]
  unit?: Unit
  meta?: EntryMeta
  createdAt: number
}

/** A saved product the user reprices as costs drift. `cost` is what they last paid, not today's price. */
export interface Product {
  id: number
  name: string
  cost: number
  targetMarginPercent: number
  price: number
  unit?: Unit
  note?: string
  /** When `cost` was last known to be true — the clock inflation ages the cost against. */
  costUpdatedAt: number
  /** Which CPI division this product tracks. Absent on every v1.3 row — the store profile fills in. */
  category?: CategoryId
  /** How dollar-linked this product is, when it differs from the store-wide setting. */
  importDependency?: ImportDependency
  /** A per-product override the user typed, used ahead of any published figure. */
  manualMonthlyPercent?: number
  createdAt: number
  updatedAt: number
}

/** Where a price reading came from, so the UI can explain why a figure is in the history. */
export type ObservationSource = 'save' | 'update' | 'calc' | 'checkin' | 'import'

/** One recorded purchase price for one product — the private series the estimator learns from. */
export interface Observation {
  id: number
  productId: number
  cost: number
  observedAt: number
  /** The FX rate on the day this cost was recorded, when one was available. */
  fxAtDate?: number
  /** A one-off or sale price the user marked as temporary: stored, but ignored by the estimator. */
  excluded?: boolean
  source: ObservationSource
}

/** The single-row store setup, keyed 'me' so there is exactly one of it. */
export interface StoreProfile {
  id: 'me'
  /** First entry is the primary category new products inherit. */
  categories: CategoryId[]
  importDependency: ImportDependency
  /** Store-wide fallback, only used when the rates file has no figures at all. */
  manualMonthlyPercent?: number
}

export const db = new Dexie('sooda') as Dexie & {
  history: EntityTable<HistoryEntry, 'id'>
  basket: EntityTable<BasketItem, 'id'>
  products: EntityTable<Product, 'id'>
  observations: EntityTable<Observation, 'id'>
  storeProfile: EntityTable<StoreProfile, 'id'>
}

db.version(1).stores({
  history: '++id, mode, createdAt',
})

db.version(2).stores({
  history: '++id, mode, createdAt',
  basket: '++id, createdAt',
})

/* v3 only ADDS `products`. history and basket are re-declared with byte-identical index strings
 * because Dexie needs the full schema per version — changing a character here would rebuild the
 * store and put every v1.2 row at risk. The widened tuple types above need no upgrade function:
 * IndexedDB stores the arrays as-is and a 2-element array is a valid `number[]`. */
db.version(3).stores({
  history: '++id, mode, createdAt',
  basket: '++id, createdAt',
  products: '++id, name, updatedAt, costUpdatedAt',
})

/**
 * The v3 → v4 backfill: one observation per existing product, built from the cost the shopkeeper
 * already recorded. Pure and exported so the migration's data shape is testable without IndexedDB.
 */
export function backfillObservations(products: Product[]): Omit<Observation, 'id'>[] {
  return products.map((p) => ({
    productId: p.id,
    cost: p.cost,
    /* `costUpdatedAt`, not `updatedAt`: the observation must be dated when the price was true,
     * otherwise every pre-v1.4 product looks like it was re-priced on upgrade day. */
    observedAt: p.costUpdatedAt,
    source: 'import' as const,
  }))
}

/* v4 only ADDS `observations` and `storeProfile`. The other three are re-declared with byte-identical
 * index strings for the reason v3 re-declared its own predecessors: Dexie needs the full schema per
 * version, and a single changed character would rebuild a live user's store. */
db.version(4)
  .stores({
    history: '++id, mode, createdAt',
    basket: '++id, createdAt',
    products: '++id, name, updatedAt, costUpdatedAt',
    observations: '++id, productId, observedAt, [productId+observedAt]',
    storeProfile: 'id',
  })
  .upgrade(async (tx) => {
    /* A browser that half-applies an upgrade and retries must not double every product's history,
     * so an already-populated table is left exactly as it is. */
    const observations = tx.table<Omit<Observation, 'id'>>('observations')
    if ((await observations.count()) > 0) return
    const products = await tx.table<Product>('products').toArray()
    if (products.length === 0) return
    await observations.bulkAdd(backfillObservations(products))
  })

export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  await db.history.add(entry as HistoryEntry)
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  await db.history.delete(id)
}

export async function clearHistory(): Promise<void> {
  await db.history.clear()
}

/* The basket badge in the header must not pull Dexie into the main bundle,
 * so a count mirror lives in localStorage and changes are broadcast as events. */
export const BASKET_COUNT_KEY = 'sooda:basket-count'
export const BASKET_COUNT_EVENT = 'sooda:basket-count'

async function broadcastBasketCount(): Promise<void> {
  const count = await db.basket.count()
  try {
    localStorage.setItem(BASKET_COUNT_KEY, String(count))
  } catch {
    // best-effort persistence
  }
  window.dispatchEvent(new CustomEvent(BASKET_COUNT_EVENT, { detail: count }))
}

export async function addBasketItem(item: Omit<BasketItem, 'id'>): Promise<void> {
  await db.basket.add(item as BasketItem)
  await broadcastBasketCount()
}

export async function deleteBasketItem(id: number): Promise<void> {
  await db.basket.delete(id)
  await broadcastBasketCount()
}

export async function clearBasket(): Promise<void> {
  await db.basket.clear()
  await broadcastBasketCount()
}

/** Re-publishes the badge count after a bulk write (backup restore) bypassed the helpers above. */
export async function refreshBasketCount(): Promise<void> {
  await broadcastBasketCount()
}
