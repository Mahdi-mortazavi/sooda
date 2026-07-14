import Dexie, { type EntityTable } from 'dexie'
import type { Mode } from './calc'
import type { Unit } from './units'

export interface HistoryEntry {
  id: number
  mode: Mode
  /** [first input, second input] as entered (already parsed to numbers) */
  inputs: [number, number]
  /** [primary result, secondary result] */
  results: [number, number]
  /** Currency/unit preset active when the calculation was made (absent = none). */
  unit?: Unit
  createdAt: number
}

/** One calculation added to the basket for summing. Same shape as history entries. */
export interface BasketItem {
  id: number
  mode: Mode
  inputs: [number, number]
  results: [number, number]
  unit?: Unit
  createdAt: number
}

export const db = new Dexie('sooda') as Dexie & {
  history: EntityTable<HistoryEntry, 'id'>
  basket: EntityTable<BasketItem, 'id'>
}

db.version(1).stores({
  history: '++id, mode, createdAt',
})

db.version(2).stores({
  history: '++id, mode, createdAt',
  basket: '++id, createdAt',
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
