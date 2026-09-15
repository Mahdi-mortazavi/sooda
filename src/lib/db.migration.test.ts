/**
 * Guards the v1.2.0 → v1.3 upgrade. Two separate things are proved here:
 *
 *  1. SCHEMA — that v3 only *adds* a store. Vitest runs in the `node` environment and no fake
 *     IndexedDB backend is available (adding one would mean adding a dependency), so the real
 *     upgrade transaction cannot be executed. What can be inspected is Dexie's own declaration
 *     table, which is what Dexie itself diffs when it decides whether to rebuild an object store.
 *  2. DATA SHAPE — that rows written by v1.2.0, replayed through every v1.3 reader, still produce
 *     byte-for-byte what v1.2.0 produced. This needs no IndexedDB at all and is what "old data
 *     survives" actually means to a user.
 */

import { describe, expect, it } from 'vitest'
import { computeBasketTotals } from './basket'
import { validateBackup, BACKUP_VERSION, type BackupFile } from './backup'
import { buildHistoryCsv } from './csv'
import { db, type HistoryEntry } from './db'

/* The exact strings v1.2.0 shipped. Copied here as literals on purpose: if someone edits db.ts,
 * this file must disagree with them rather than quietly follow along. */
const V1_STORES = { history: '++id, mode, createdAt' }
const V2_STORES = { history: '++id, mode, createdAt', basket: '++id, createdAt' }
const V3_PRODUCTS = '++id, name, updatedAt, costUpdatedAt'

/* Dexie's declared-version list is absent from its public .d.ts, but it is the only place the raw
 * `stores()` arguments survive — and those arguments are precisely what an upgrade is judged on. */
interface DeclaredVersion {
  _cfg: { version: number; storesSource: Record<string, string | null> }
}

const declaredVersions = (db as unknown as { _versions: DeclaredVersion[] })._versions

function storesFor(version: number): Record<string, string | null> {
  const found = declaredVersions.find((v) => v._cfg.version === version)
  if (!found) throw new Error(`no Dexie version ${version} is declared`)
  return found._cfg.storesSource
}

describe('schema declarations', () => {
  it('is at version 3 with all three versions still declared', () => {
    expect(db.verno).toBe(3)
    expect(declaredVersions.map((v) => v._cfg.version)).toEqual([1, 2, 3])
  })

  it('keeps the v1 declaration byte-identical to what v1.2.0 shipped', () => {
    expect(storesFor(1)).toEqual(V1_STORES)
  })

  it('keeps the v2 declaration byte-identical to what v1.2.0 shipped', () => {
    expect(storesFor(2)).toEqual(V2_STORES)
  })

  it('re-declares history and basket in v3 with unchanged index strings', () => {
    const v3 = storesFor(3)
    for (const [table, spec] of Object.entries(V2_STORES)) {
      expect(v3[table]).toBe(spec)
    }
  })

  it('adds exactly one new store in v3, and drops none', () => {
    const v3 = storesFor(3)
    expect(Object.keys(v3).sort()).toEqual(['basket', 'history', 'products'])
    const added = Object.keys(v3).filter((t) => !(t in V2_STORES))
    expect(added).toEqual(['products'])
    expect(v3.products).toBe(V3_PRODUCTS)
  })

  it('never deletes a store (a null spec would drop one and take its rows with it)', () => {
    for (const version of declaredVersions) {
      for (const spec of Object.values(version._cfg.storesSource)) {
        expect(spec).not.toBeNull()
      }
    }
  })

  it('declares no upgrade function, because widening the tuples needs no data rewrite', () => {
    const cfg = declaredVersions.map((v) => v._cfg as { contentUpgrade?: unknown })
    for (const c of cfg) expect(c.contentUpgrade ?? null).toBeNull()
  })
})

describe('resolved runtime schema', () => {
  it('exposes the three tables with the expected indexes', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(['basket', 'history', 'products'])
    expect(db.history.schema.indexes.map((i) => i.name)).toEqual(['mode', 'createdAt'])
    expect(db.basket.schema.indexes.map((i) => i.name)).toEqual(['createdAt'])
    expect(db.products.schema.indexes.map((i) => i.name)).toEqual(['name', 'updatedAt', 'costUpdatedAt'])
  })

  it('keeps every table on an auto-incrementing `id` primary key', () => {
    for (const table of db.tables) {
      expect(table.schema.primKey.keyPath).toBe('id')
      expect(table.schema.primKey.auto).toBe(true)
    }
  })
})

/* Rows exactly as v1.2.0 wrote them: two inputs, two results, no `meta` key at all. The tuple
 * annotations are what v1.2.0's own interfaces declared, so these values type-check against both
 * the old `[number, number]` contract and the widened `number[]` one. */
const v2Profit = {
  id: 1,
  mode: 'profit' as const,
  inputs: [100_000, 20] as [number, number],
  results: [120_000, 20_000] as [number, number],
  unit: 'toman' as const,
  createdAt: Date.UTC(2025, 0, 2, 3, 4, 5),
}

const v2Discount = {
  id: 2,
  mode: 'discount' as const,
  inputs: [200, 15] as [number, number],
  results: [170, 30] as [number, number],
  unit: 'toman' as const,
  createdAt: Date.UTC(2025, 0, 3, 3, 4, 5),
}

/* A v1.0/v1.1 row, written before the unit picker existed. */
const v1Unitless = {
  id: 3,
  mode: 'sell' as const,
  inputs: [200, 260] as [number, number],
  results: [30, 60] as [number, number],
  createdAt: Date.UTC(2025, 0, 4, 3, 4, 5),
}

describe('v1.2.0 rows read by v1.3 code', () => {
  it('totals a basket exactly as v1.2.0 did', () => {
    const totals = computeBasketTotals([v2Profit, v2Discount, v1Unitless])
    expect(totals).toHaveLength(2)
    const toman = totals[0]!
    expect(toman.unit).toBe('toman')
    expect(toman.sellerCount).toBe(1)
    expect(toman.cost).toBe(100_000)
    expect(toman.revenue).toBe(120_000)
    expect(toman.profit).toBe(20_000)
    expect(toman.marginPercent).toBe(20)
    expect(toman.shopperCount).toBe(1)
    expect(toman.original).toBe(200)
    expect(toman.pay).toBe(170)
    expect(toman.saved).toBe(30)
    // The unit-less row groups under 'none' rather than being dropped or merged.
    const none = totals[1]!
    expect(none.unit).toBe('none')
    expect(none.sellerCount).toBe(1)
    expect(none.cost).toBe(200)
    expect(none.revenue).toBe(260)
    expect(none.profit).toBe(60)
  })

  it('exports the same CSV v1.2.0 exported', () => {
    const headers = ['date', 'mode', 'input1', 'input2', 'result1', 'result2', 'unit']
    const csv = buildHistoryCsv([v2Profit, v2Discount, v1Unitless], headers, {
      profit: 'Profit %',
      discount: 'Discount',
      sell: 'Sell price',
    })
    expect(csv).toBe(
      '﻿' +
        [
          'date,mode,input1,input2,result1,result2,unit',
          '2025-01-02T03:04:05.000Z,Profit %,100000,20,120000,20000,toman',
          '2025-01-03T03:04:05.000Z,Discount,200,15,170,30,toman',
          '2025-01-04T03:04:05.000Z,Sell price,200,260,30,60,',
        ].join('\n'),
    )
  })

  it('validates inside a backup file and survives a JSON round trip unchanged', () => {
    const file: BackupFile = {
      app: 'sooda',
      version: BACKUP_VERSION,
      exportedAt: Date.UTC(2026, 8, 15),
      products: [],
      history: [v2Profit, v2Discount, v1Unitless],
      basket: [v2Profit],
      settings: { 'sooda:unit': 'toman' },
    }
    const result = validateBackup(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.history).toEqual([v2Profit, v2Discount, v1Unitless])
    // No `meta` key is invented on the way through — the row comes back exactly as it went in.
    expect(Object.keys(result.data.history[0]!).sort()).toEqual(['createdAt', 'id', 'inputs', 'mode', 'results', 'unit'])
    expect(Object.keys(result.data.history[2]!).sort()).toEqual(['createdAt', 'id', 'inputs', 'mode', 'results'])
  })

  it('still satisfies the widened HistoryEntry type', () => {
    const widened: HistoryEntry[] = [v2Profit, v2Discount, v1Unitless]
    expect(widened.every((e) => e.inputs.length === 2 && e.results.length === 2)).toBe(true)
    expect(widened.every((e) => e.meta === undefined)).toBe(true)
  })
})
