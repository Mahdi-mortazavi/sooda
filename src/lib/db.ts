import Dexie, { type EntityTable } from 'dexie'
import type { Mode } from './calc'
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
  createdAt: number
  updatedAt: number
}

export const db = new Dexie('sooda') as Dexie & {
  history: EntityTable<HistoryEntry, 'id'>
  basket: EntityTable<BasketItem, 'id'>
  products: EntityTable<Product, 'id'>
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
