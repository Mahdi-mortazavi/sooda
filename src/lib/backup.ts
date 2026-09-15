/** Whole-app export/import: the only way a user moves their data between devices, so validation is paranoid. */

import { db, refreshBasketCount, type BasketItem, type HistoryEntry, type Product } from './db'

export const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'sooda'
  version: number
  exportedAt: number
  products: Product[]
  history: HistoryEntry[]
  basket: BasketItem[]
  /** every localStorage key starting with 'sooda:' */
  settings: Record<string, string>
}

const SETTINGS_PREFIX = 'sooda:'

function readSettings(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null || !key.startsWith(SETTINGS_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (value !== null) out[key] = value
    }
  } catch {
    // storage unavailable
  }
  return out
}

/** Reads everything out of Dexie + localStorage. */
export async function buildBackup(now = Date.now()): Promise<BackupFile> {
  const [products, history, basket] = await Promise.all([
    db.products.toArray(),
    db.history.toArray(),
    db.basket.toArray(),
  ])
  return { app: 'sooda', version: BACKUP_VERSION, exportedAt: now, products, history, basket, settings: readSettings() }
}

export type BackupProblem = 'notJson' | 'notSooda' | 'unsupportedVersion' | 'malformed'

export type BackupCheck = { ok: true; data: BackupFile } | { ok: false; problem: BackupProblem }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isNum)
}

function isArrayOf<T>(value: unknown, guard: (v: unknown) => v is T): value is T[] {
  return Array.isArray(value) && value.every(guard)
}

/* `id` is deliberately NOT required: a merge import drops ids anyway, and rows hand-written by a
 * user or produced by an older export are still perfectly restorable without one. */
function isEntryRow(value: unknown): value is HistoryEntry {
  if (!isRecord(value)) return false
  if (value.id !== undefined && !isNum(value.id)) return false
  if (typeof value.mode !== 'string') return false
  if (!isNumArray(value.inputs) || !isNumArray(value.results)) return false
  return isNum(value.createdAt)
}

function isProductRow(value: unknown): value is Product {
  if (!isRecord(value)) return false
  if (value.id !== undefined && !isNum(value.id)) return false
  if (typeof value.name !== 'string') return false
  for (const key of ['cost', 'targetMarginPercent', 'price', 'costUpdatedAt', 'createdAt', 'updatedAt']) {
    if (!isNum(value[key])) return false
  }
  return true
}

function isSettings(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((v) => typeof v === 'string')
}

/**
 * Pure. Accepts a parsed object OR a raw JSON string, and is total: it returns a problem for any
 * input at all rather than throwing, because the input is a file the user picked off their disk.
 */
export function validateBackup(raw: unknown): BackupCheck {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, problem: 'notJson' }
    }
  }
  // Anything that isn't a JSON object (a number, an array, null) can't be a backup at all.
  if (!isRecord(parsed)) return { ok: false, problem: 'notJson' }
  const file: Record<string, unknown> = parsed
  if (file.app !== 'sooda') return { ok: false, problem: 'notSooda' }
  const version = file.version
  if (!isNum(version) || version < 1 || version > BACKUP_VERSION) {
    return { ok: false, problem: 'unsupportedVersion' }
  }
  const products = file.products
  const history = file.history
  const basket = file.basket
  if (!isArrayOf(products, isProductRow)) return { ok: false, problem: 'malformed' }
  if (!isArrayOf(history, isEntryRow)) return { ok: false, problem: 'malformed' }
  if (!isArrayOf(basket, isEntryRow)) return { ok: false, problem: 'malformed' }
  const settings: unknown = file.settings === undefined ? {} : file.settings
  if (!isSettings(settings)) return { ok: false, problem: 'malformed' }
  return {
    ok: true,
    data: {
      app: 'sooda',
      version,
      exportedAt: isNum(file.exportedAt) ? file.exportedAt : 0,
      products,
      history,
      basket,
      settings,
    },
  }
}

/* A merge must not reuse incoming keys: restoring onto a non-empty database would throw on the
 * first collision. Dexie mints fresh auto-increment ids whenever the key is absent. */
function withoutIds<T extends { id: number }>(rows: T[]): T[] {
  return rows.map((row) => {
    const copy = { ...row }
    delete (copy as Partial<T>).id
    return copy
  })
}

function restoreSettings(settings: Record<string, string>): void {
  try {
    for (const [key, value] of Object.entries(settings)) {
      // Never let an imported file write outside Sooda's own key namespace.
      if (key.startsWith(SETTINGS_PREFIX)) localStorage.setItem(key, value)
    }
  } catch {
    // storage unavailable
  }
}

/** 'replace' clears the three tables first; 'merge' appends, dropping incoming `id`s so nothing collides. Single transaction. */
export async function applyBackup(data: BackupFile, mode: 'merge' | 'replace'): Promise<void> {
  await db.transaction('rw', db.products, db.history, db.basket, async () => {
    if (mode === 'replace') {
      await db.products.clear()
      await db.history.clear()
      await db.basket.clear()
      await db.products.bulkPut(data.products)
      await db.history.bulkPut(data.history)
      await db.basket.bulkPut(data.basket)
    } else {
      await db.products.bulkAdd(withoutIds(data.products))
      await db.history.bulkAdd(withoutIds(data.history))
      await db.basket.bulkAdd(withoutIds(data.basket))
    }
  })
  restoreSettings(data.settings)
  // The header badge mirrors the basket in localStorage and knows nothing about bulk writes.
  await refreshBasketCount()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** e.g. 'sooda-backup-2026-09-15.json' — local date, so the name matches the day the user sees. */
export function backupFilename(now = Date.now()): string {
  const d = new Date(now)
  return `sooda-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}
