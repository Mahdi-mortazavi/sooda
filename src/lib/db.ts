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

export const db = new Dexie('sooda') as Dexie & {
  history: EntityTable<HistoryEntry, 'id'>
}

db.version(1).stores({
  history: '++id, mode, createdAt',
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
