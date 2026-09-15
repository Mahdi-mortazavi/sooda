/** Whole-app export/import: the only way a user moves their data between devices, so validation is paranoid. */

import {
  db,
  refreshBasketCount,
  type BasketItem,
  type HistoryEntry,
  type Observation,
  type Product,
  type StoreProfile,
} from './db'
import { isCategoryId, isImportDependency } from './rates/categories'

/* 2 adds `observations` and `storeProfile`. A version-1 file written by v1.3 is still a perfectly
 * good backup and must keep importing — it simply carries no price history. */
export const BACKUP_VERSION = 2

export interface BackupFile {
  app: 'sooda'
  version: number
  exportedAt: number
  products: Product[]
  history: HistoryEntry[]
  basket: BasketItem[]
  /** Empty for a version-1 file: v1.3 had no price history to export. */
  observations: Observation[]
  /** `null` when the user never went through store setup (and always, for a version-1 file). */
  storeProfile: StoreProfile | null
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
  const [products, history, basket, observations, storeProfile] = await Promise.all([
    db.products.toArray(),
    db.history.toArray(),
    db.basket.toArray(),
    db.observations.toArray(),
    db.storeProfile.get('me'),
  ])
  return {
    app: 'sooda',
    version: BACKUP_VERSION,
    exportedAt: now,
    products,
    history,
    basket,
    observations,
    storeProfile: storeProfile ?? null,
    settings: readSettings(),
  }
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

const OBSERVATION_SOURCES = ['save', 'update', 'calc', 'checkin', 'import']

/* Same leniency as the rows above: `id` is optional, because a merge import drops it anyway. */
function isObservationRow(value: unknown): value is Observation {
  if (!isRecord(value)) return false
  if (value.id !== undefined && !isNum(value.id)) return false
  if (!isNum(value.productId) || !isNum(value.cost) || !isNum(value.observedAt)) return false
  if (value.fxAtDate !== undefined && !isNum(value.fxAtDate)) return false
  if (value.excluded !== undefined && typeof value.excluded !== 'boolean') return false
  return typeof value.source === 'string' && OBSERVATION_SOURCES.includes(value.source)
}

/* A profile is one row the user can rebuild in a minute, so a broken one is dropped rather than
 * failing the whole import and costing them their price list. */
function readStoreProfileRow(value: unknown): StoreProfile | null {
  if (!isRecord(value)) return null
  if (!Array.isArray(value.categories) || !value.categories.every(isCategoryId)) return null
  if (!isImportDependency(value.importDependency)) return null
  const manual = value.manualMonthlyPercent
  if (manual !== undefined && !isNum(manual)) return null
  return {
    id: 'me',
    categories: value.categories,
    importDependency: value.importDependency,
    ...(manual === undefined ? {} : { manualMonthlyPercent: manual }),
  }
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
  /* Absent is the normal state for a version-1 file, and means "no history", not "bad file".
   * Present-but-wrong is still malformed, because it means the file was tampered with. */
  const observations: unknown = file.observations === undefined ? [] : file.observations
  if (!isArrayOf(observations, isObservationRow)) return { ok: false, problem: 'malformed' }
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
      observations,
      storeProfile: file.storeProfile === undefined ? null : readStoreProfileRow(file.storeProfile),
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

/**
 * Re-points imported observations at the ids the merged products actually received. An observation
 * whose product did not come along is DROPPED: left alone it would keep its old `productId` and
 * silently attach itself to whatever unrelated row already holds that id, poisoning that product's
 * estimate. A missing reading is recoverable; a wrong one is not.
 */
export function remapObservations(
  observations: Observation[],
  products: Product[],
  newProductIds: number[],
): Omit<Observation, 'id'>[] {
  const byOldId = new Map<number, number>()
  products.forEach((p, i) => {
    const fresh = newProductIds[i]
    if (typeof p.id === 'number' && fresh !== undefined) byOldId.set(p.id, fresh)
  })
  const out: Omit<Observation, 'id'>[] = []
  for (const o of observations) {
    const productId = byOldId.get(o.productId)
    if (productId === undefined) continue
    const copy: Observation = { ...o, productId }
    delete (copy as Partial<Observation>).id
    out.push(copy)
  }
  return out
}

/** 'replace' clears the tables first; 'merge' appends, dropping incoming `id`s so nothing collides. Single transaction. */
export async function applyBackup(data: BackupFile, mode: 'merge' | 'replace'): Promise<void> {
  await db.transaction('rw', db.products, db.history, db.basket, db.observations, db.storeProfile, async () => {
    if (mode === 'replace') {
      await db.products.clear()
      await db.history.clear()
      await db.basket.clear()
      await db.observations.clear()
      await db.storeProfile.clear()
      await db.products.bulkPut(data.products)
      await db.history.bulkPut(data.history)
      await db.basket.bulkPut(data.basket)
      await db.observations.bulkPut(data.observations)
      if (data.storeProfile !== null) await db.storeProfile.put({ ...data.storeProfile, id: 'me' })
    } else {
      /* `allKeys` is the whole point: without the ids Dexie minted here there is no honest way to
       * re-point the observations, and guessing would be worse than dropping them. */
      const newIds = (await db.products.bulkAdd(withoutIds(data.products), { allKeys: true })) as number[]
      await db.history.bulkAdd(withoutIds(data.history))
      await db.basket.bulkAdd(withoutIds(data.basket))
      const remapped = remapObservations(data.observations, data.products, newIds)
      if (remapped.length > 0) await db.observations.bulkAdd(remapped as Observation[])
      /* A merge keeps the device's own store setup: the user is adding someone's data to their
       * shop, not adopting their shop. An imported profile only fills a genuinely empty slot. */
      if (data.storeProfile !== null && (await db.storeProfile.get('me')) === undefined) {
        await db.storeProfile.put({ ...data.storeProfile, id: 'me' })
      }
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
