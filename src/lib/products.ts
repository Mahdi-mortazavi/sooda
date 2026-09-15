/** Saved products: the Dexie repository plus the pure maths the products screen sorts and previews with. */

import { round2 } from './calc'
import { monthsBetween } from './dates'
import { db, type Product } from './db'
import { monthlyRateFromPercent, profitStatus, realProfitPercent, replacementCost } from './inflation'
import { normalizeDigits } from './numbers'
import { roundUpTo, type RoundingStep } from './rounding'

/* ── repository ─────────────────────────────────────────────────────────── */

/** Adds a product, stamping both timestamps. Returns the new id. */
export async function addProduct(p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = Date.now()
  return db.products.add({ ...p, createdAt: now, updatedAt: now })
}

/** Patches a product and stamps `updatedAt`, so the "recently changed" sort stays honest. */
export async function updateProduct(id: number, patch: Partial<Omit<Product, 'id'>>): Promise<void> {
  await db.products.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id)
}

export async function listProducts(): Promise<Product[]> {
  return db.products.toArray()
}

/** One change a bulk reprice wants to commit. `cost`/`costUpdatedAt` only move on a cost-up run. */
export interface ProductChange {
  id: number
  price: number
  cost?: number
  costUpdatedAt?: number
}

/** Applies every change inside ONE Dexie transaction so a bulk reprice is all-or-nothing. */
export async function bulkApply(changes: ProductChange[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.products, async () => {
    for (const c of changes) {
      await db.products.update(c.id, {
        price: c.price,
        updatedAt: now,
        ...(c.cost === undefined ? {} : { cost: c.cost }),
        ...(c.costUpdatedAt === undefined ? {} : { costUpdatedAt: c.costUpdatedAt }),
      })
    }
  })
}

/** Undo path — writes the given rows back verbatim (ids and timestamps included), also in one transaction. */
export async function restoreProducts(snapshot: Product[]): Promise<void> {
  await db.transaction('rw', db.products, async () => {
    await db.products.bulkPut(snapshot)
  })
}

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
export function productStatus(p: Product, annualInflationPercent: number, now: number): ProductStatus {
  const costAgeMonths = monthsBetween(p.costUpdatedAt, now)
  const replacement = replacementCost(p.cost, monthlyRateFromPercent(annualInflationPercent), costAgeMonths)
  const realMarginPercent = realProfitPercent(p.price, replacement)
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

export interface BulkPreviewRow {
  id: number
  name: string
  oldPrice: number
  newPrice: number
  oldCost: number
  newCost: number
}

/**
 * 'costUp': cost ×(1+percent/100), then price = newCost·(1+targetMargin/100), rounded up by `step`.
 * 'retarget': cost unchanged, price = cost·(1+targetMargin/100), rounded up by `step`.
 * Pure — returns what WOULD change, applies nothing. Rows whose price and cost both stay the same
 * are still returned, because only the caller knows whether to show or hide a no-op row.
 */
export function previewBulk(items: Product[], op: BulkOp, step: RoundingStep): BulkPreviewRow[] {
  return items.map((p) => {
    const newCost = op.kind === 'costUp' ? round2(p.cost * (1 + op.percent / 100)) : p.cost
    return {
      id: p.id,
      name: p.name,
      oldPrice: p.price,
      newPrice: roundUpTo(newCost * (1 + p.targetMarginPercent / 100), step),
      oldCost: p.cost,
      newCost,
    }
  })
}

/* Deliberately duplicated from csv.ts: that module is owned by the history export and importing it
 * here would drag the history builder (and its mode labels) into the products chunk. */
function escapeCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
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
