/** Saved products: the Dexie repository plus the pure maths the products screen sorts and previews with. */

import { round2 } from './calc'
import { monthsBetween } from './dates'
import { db, type Observation, type Product, type SoodaDb } from './db'
import { monthlyRateFromPercent, profitStatus, realProfitPercent, replacementCost } from './inflation'
import { normalizeDigits } from './numbers'
import { roundUpTo, type RoundingStep } from './rounding'

/* ── repository ─────────────────────────────────────────────────────────── */

/** One change a bulk reprice wants to commit. `cost`/`costUpdatedAt` only move on a cost-up run. */
export interface ProductChange {
  id: number
  price: number
  cost?: number
  costUpdatedAt?: number
}

/** What a bulk reprice wrote, so the undo path can take back exactly that and nothing else. */
export interface BulkApplyResult {
  /** Ids of the observations this run created, in the order the changes were applied. */
  observationIds: number[]
}

export interface ProductRepository {
  addProduct(p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>
  updateProduct(id: number, patch: Partial<Omit<Product, 'id'>>): Promise<void>
  deleteProduct(id: number): Promise<void>
  listProducts(): Promise<Product[]>
  bulkApply(changes: ProductChange[]): Promise<BulkApplyResult>
  restoreProducts(snapshot: Product[], observationIds?: number[]): Promise<void>
}

/**
 * The saved products, bound to whichever database it is given.
 *
 * Taking the database as an argument rather than importing the singleton is what makes practice
 * mode honest: a lesson runs this exact logic — including which writes count as a new price
 * reading — against a throwaway store, without touching a row of the shopkeeper's own. Every
 * existing caller keeps using the bound exports below and is unaffected.
 */
export function createProductRepository(database: SoodaDb): ProductRepository {
  return {
    /** Adds a product with its first price observation, stamping both timestamps. Returns the new id. */
    async addProduct(p) {
      const now = Date.now()
      return database.transaction('rw', database.products, database.observations, async () => {
        const id = await database.products.add({ ...p, createdAt: now, updatedAt: now })
        /* The very first save is already evidence. Dated `costUpdatedAt` rather than now, because the
         * user may be recording a price they paid last month. */
        const first = { productId: id, cost: p.cost, observedAt: p.costUpdatedAt, source: 'save' as const }
        await database.observations.add(first as Observation)
        return id
      })
    },

    /** Patches a product and stamps `updatedAt`, so the "recently changed" sort stays honest. */
    async updateProduct(id, patch) {
      const now = Date.now()
      await database.transaction('rw', database.products, database.observations, async () => {
        const before = await database.products.get(id)
        await database.products.update(id, { ...patch, updatedAt: now })
        /* Only a cost that actually MOVED is a new reading. Re-saving the same figure after editing a
         * note would otherwise stack duplicate points and flatten the product's estimated growth. */
        if (before === undefined || patch.cost === undefined || patch.cost === before.cost) return
        await database.observations.add({
          productId: id,
          cost: patch.cost,
          observedAt: patch.costUpdatedAt ?? now,
          source: 'update',
        } as Observation)
      })
    },

    /** Deletes a product and the whole private history behind it — orphan readings help nobody. */
    async deleteProduct(id) {
      await database.transaction('rw', database.products, database.observations, async () => {
        await database.products.delete(id)
        await database.observations.where('productId').equals(id).delete()
      })
    },

    async listProducts() {
      return database.products.toArray()
    },

    /** Applies every change inside ONE Dexie transaction so a bulk reprice is all-or-nothing. */
    async bulkApply(changes) {
      const now = Date.now()
      return database.transaction('rw', database.products, database.observations, async () => {
        const observationIds: number[] = []
        for (const c of changes) {
          /* Read before write: a 'retarget' run moves only the price, and a 'costUp' run can land on
           * the figure already stored. Neither is a new reading about what the product costs. */
          const before = await database.products.get(c.id)
          await database.products.update(c.id, {
            price: c.price,
            updatedAt: now,
            ...(c.cost === undefined ? {} : { cost: c.cost }),
            ...(c.costUpdatedAt === undefined ? {} : { costUpdatedAt: c.costUpdatedAt }),
          })
          if (before === undefined || c.cost === undefined || c.cost === before.cost) continue
          const id = await database.observations.add({
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

    /**
     * Undo path — writes the given rows back verbatim (ids and timestamps included) and deletes the
     * observations the matching `bulkApply` created, in one transaction.
     *
     * The ids are passed in rather than re-derived: deleting "every observation newer than X" would
     * also swallow a reading the user recorded by hand between the reprice and the undo.
     */
    async restoreProducts(snapshot, observationIds = []) {
      await database.transaction('rw', database.products, database.observations, async () => {
        await database.products.bulkPut(snapshot)
        if (observationIds.length > 0) await database.observations.bulkDelete(observationIds)
      })
    },
  }
}

/* The real shop. Every component that is not running a lesson uses these. */
const real = createProductRepository(db)

export const addProduct = real.addProduct
export const updateProduct = real.updateProduct
export const deleteProduct = real.deleteProduct
export const listProducts = real.listProducts
export const bulkApply = real.bulkApply
export const restoreProducts = real.restoreProducts

/**
 * Best-effort `navigator.storage.persist()`, called on the first product save: a price list is the
 * first thing in Sooda worth losing sleep over, but a browser that refuses must not fail the save.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function') return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    // unsupported, denied, or a non-secure context — all equally "not persisted"
    return false
  }
}

/* ── pure helpers (no `db` access — unit-testable in the node environment) ─ */

export type ProductHealth = 'healthy' | 'thin' | 'losing'

export interface ProductStatus {
  /** today's estimated restock cost */
  replacement: number
  /** (price / replacement − 1) · 100 */
  realMarginPercent: number
  health: ProductHealth
  costAgeMonths: number
}

/** Estimates today's restock cost from `cost`, the months since `costUpdatedAt`, and inflation. */
export function productStatus(p: Product, monthlyInflationPercent: number, now: number): ProductStatus {
  const costAgeMonths = monthsBetween(p.costUpdatedAt, now)
  const replacement = replacementCost(p.cost, monthlyRateFromPercent(monthlyInflationPercent), costAgeMonths)
  // A row with no recorded purchase price cannot be judged; dividing by it would yield
  // Infinity or NaN, and NaN silently reads as 'thin'. Flag it instead.
  const realMarginPercent = replacement > 0 ? realProfitPercent(p.price, replacement) : 0
  return {
    replacement,
    realMarginPercent,
    health: profitStatus(realMarginPercent, p.targetMarginPercent),
    costAgeMonths,
  }
}

export type ProductSort = 'risk' | 'name' | 'updated'

/* Persian first so fa names collate by the Persian alphabet, with en as the fallback for Latin ones. */
const nameCollator = new Intl.Collator(['fa', 'en'], { numeric: true, sensitivity: 'base' })

/** 'risk' = worst real margin first. 'name' = locale-aware A→Z. 'updated' = most recent first. Stable, pure, returns a new array. */
export function sortProducts(items: Product[], sort: ProductSort, statuses: Map<number, ProductStatus>): Product[] {
  const out = items.slice()
  // Array.prototype.sort is stable in ES2019+, so equal keys keep their incoming order.
  if (sort === 'name') {
    out.sort((a, b) => nameCollator.compare(a.name, b.name))
  } else if (sort === 'updated') {
    out.sort((a, b) => b.updatedAt - a.updatedAt)
  } else {
    /* A product with no computed status sinks to the bottom rather than being reported as the
     * biggest risk; comparing before subtracting keeps Infinity − Infinity out of the comparator. */
    const risk = (p: Product): number => statuses.get(p.id)?.realMarginPercent ?? Number.POSITIVE_INFINITY
    out.sort((a, b) => {
      const ra = risk(a)
      const rb = risk(b)
      return ra === rb ? 0 : ra < rb ? -1 : 1
    })
  }
  return out
}

/** Case-insensitive name match, tolerant of Persian/Arabic digits via normalizeDigits. */
export function searchProducts(items: Product[], query: string): Product[] {
  const q = normalizeDigits(query).trim().toLowerCase()
  if (q === '') return items
  return items.filter((p) => normalizeDigits(p.name).toLowerCase().includes(q))
}

export type BulkOp = { kind: 'costUp'; percent: number } | { kind: 'retarget' }

/** Below −100% a price increase turns the cost negative, so the input is refused outright. */
export const MIN_COST_CHANGE_PERCENT = -100

export interface BulkPreviewRow {
  id: number
  name: string
  oldPrice: number
  newPrice: number
  oldCost: number
  newCost: number
}

/**
 * 'costUp': the purchase price really went up by `percent`, so the cost is re-stamped and the
 * selling price is rebuilt on it.
 * 'retarget': the recorded cost is left alone — it is what the user actually paid — and the price
 * is rebuilt on today's *replacement* cost, because that is the cost the app's own margin is
 * measured against. Pricing off a stale purchase price would hand back a row the products list
 * immediately calls losing.
 *
 * Both round the new price up by `step`. Pure — returns what WOULD change, applies nothing. Rows
 * whose price and cost both stay the same are still returned, because only the caller knows
 * whether to show or hide a no-op row.
 */
export function previewBulk(
  items: Product[],
  op: BulkOp,
  step: RoundingStep,
  monthlyInflationPercent: number,
  now: number,
): BulkPreviewRow[] {
  const percent = op.kind === 'costUp' ? Math.max(op.percent, MIN_COST_CHANGE_PERCENT) : 0
  return items.map((p) => {
    const newCost = op.kind === 'costUp' ? round2(p.cost * (1 + percent / 100)) : p.cost
    const basis = op.kind === 'costUp' ? newCost : productStatus(p, monthlyInflationPercent, now).replacement
    return {
      id: p.id,
      name: p.name,
      oldPrice: p.price,
      newPrice: roundUpTo(basis * (1 + p.targetMarginPercent / 100), step),
      oldCost: p.cost,
      newCost,
    }
  })
}

/* Deliberately duplicated from csv.ts: that module is owned by the history export and importing it
 * here would drag the history builder (and its mode labels) into the products chunk. */
function escapeCell(value: string): string {
  /* A cell beginning =, +, - or @ is a formula to Excel and LibreOffice, so a product named
   * `=HYPERLINK(...)` would turn this export into an outbound request carrying the shop's own
   * cost figures the moment it was opened. Prefixing an apostrophe makes it literal text.
   * Reachable through a restored backup, which accepts any name string. */
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Build a CSV export of the price list (with UTF-8 BOM so Excel renders Persian text correctly). */
export function buildProductsCsv(items: Product[], headers: string[]): string {
  const rows = [headers.map(escapeCell).join(',')]
  for (const p of items) {
    rows.push(
      [
        p.name,
        String(p.cost),
        String(p.targetMarginPercent),
        String(p.price),
        p.unit && p.unit !== 'none' ? p.unit : '',
        p.note ?? '',
        new Date(p.costUpdatedAt).toISOString(),
        new Date(p.updatedAt).toISOString(),
      ]
        .map(escapeCell)
        .join(','),
    )
  }
  return '﻿' + rows.join('\n')
}
