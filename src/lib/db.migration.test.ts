/**
 * Guards the v1.2.0 → v1.3 and the v1.3 → v1.4 upgrades. Two separate things are proved here:
 *
 *  1. SCHEMA — that each new version only *adds* stores. Vitest runs in the `node` environment and
 *     no fake IndexedDB backend is available (adding one would mean adding a dependency), so the
 *     real upgrade transaction cannot be executed. What can be inspected is Dexie's own declaration
 *     table, which is what Dexie itself diffs when it decides whether to rebuild an object store.
 *  2. DATA SHAPE — that rows written by an older build, replayed through every current reader, still
 *     produce byte-for-byte what that build produced, and that the v3 → v4 backfill turns a real
 *     v3-shaped product into exactly one correct observation. This needs no IndexedDB at all and is
 *     what "old data survives" actually means to a user.
 */

import { describe, expect, it } from 'vitest'
import { computeBasketTotals } from './basket'
import { validateBackup, BACKUP_VERSION, type BackupFile } from './backup'
import { buildHistoryCsv } from './csv'
import { backfillObservations, db, type HistoryEntry, type Product } from './db'

/* The exact strings v1.2.0 shipped. Copied here as literals on purpose: if someone edits db.ts,
 * this file must disagree with them rather than quietly follow along. */
const V1_STORES = { history: '++id, mode, createdAt' }
const V2_STORES = { history: '++id, mode, createdAt', basket: '++id, createdAt' }
const V3_PRODUCTS = '++id, name, updatedAt, costUpdatedAt'
const V3_STORES = { ...V2_STORES, products: V3_PRODUCTS }
/* What v1.4 adds, and nothing else. */
const V4_OBSERVATIONS = '++id, productId, observedAt, [productId+observedAt]'
const V4_STORE_PROFILE = 'id'

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
  it('is at version 4 with all four versions still declared', () => {
    expect(db.verno).toBe(4)
    expect(declaredVersions.map((v) => v._cfg.version)).toEqual([1, 2, 3, 4])
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

  it('keeps the v3 declaration byte-identical to what v1.3.0 shipped', () => {
    expect(storesFor(3)).toEqual(V3_STORES)
  })

  it('re-declares history, basket and products in v4 with unchanged index strings', () => {
    const v4 = storesFor(4)
    for (const [table, spec] of Object.entries(V3_STORES)) {
      expect(v4[table]).toBe(spec)
    }
  })

  it('adds exactly two new stores in v4, and drops none', () => {
    const v4 = storesFor(4)
    expect(Object.keys(v4).sort()).toEqual(['basket', 'history', 'observations', 'products', 'storeProfile'])
    const added = Object.keys(v4).filter((t) => !(t in V3_STORES))
    expect(added.sort()).toEqual(['observations', 'storeProfile'])
    expect(v4.observations).toBe(V4_OBSERVATIONS)
    expect(v4.storeProfile).toBe(V4_STORE_PROFILE)
  })

  it('carries an upgrade function on v4 only — v1–v3 needed no data rewrite', () => {
    const upgradeOf = (version: number): unknown => {
      const found = declaredVersions.find((v) => v._cfg.version === version)
      return (found?._cfg as { contentUpgrade?: unknown } | undefined)?.contentUpgrade ?? null
    }
    for (const version of [1, 2, 3]) expect(upgradeOf(version)).toBeNull()
    expect(typeof upgradeOf(4)).toBe('function')
  })
})

describe('resolved runtime schema', () => {
  it('exposes the five tables with the expected indexes', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'basket',
      'history',
      'observations',
      'products',
      'storeProfile',
    ])
    expect(db.history.schema.indexes.map((i) => i.name)).toEqual(['mode', 'createdAt'])
    expect(db.basket.schema.indexes.map((i) => i.name)).toEqual(['createdAt'])
    expect(db.products.schema.indexes.map((i) => i.name)).toEqual(['name', 'updatedAt', 'costUpdatedAt'])
    expect(db.observations.schema.indexes.map((i) => i.name)).toEqual([
      'productId',
      'observedAt',
      '[productId+observedAt]',
    ])
    // The one index the whole products screen leans on must really be compound.
    const compound = db.observations.schema.indexes.find((i) => i.name === '[productId+observedAt]')
    expect(compound?.compound).toBe(true)
    expect(compound?.keyPath).toEqual(['productId', 'observedAt'])
  })

  it('keeps every row table on an auto-incrementing `id`, and the profile on its fixed key', () => {
    for (const table of db.tables) {
      expect(table.schema.primKey.keyPath).toBe('id')
      // storeProfile holds exactly one row under the key 'me', so it must NOT auto-increment.
      expect(table.schema.primKey.auto).toBe(table.name !== 'storeProfile')
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
      observations: [],
      storeProfile: null,
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

/* Products exactly as v1.3.0 wrote them: no `category`, no `importDependency`, no
 * `manualMonthlyPercent`. They must satisfy the widened Product type unchanged. */
const v3Tea: Product = {
  id: 1,
  name: 'Tea',
  cost: 100_000,
  targetMarginPercent: 30,
  price: 130_000,
  unit: 'toman',
  note: 'top shelf',
  costUpdatedAt: Date.UTC(2026, 2, 15),
  createdAt: Date.UTC(2026, 2, 15),
  updatedAt: Date.UTC(2026, 8, 1),
}

const v3Sugar: Product = {
  id: 7,
  name: 'Sugar',
  cost: 48_500,
  targetMarginPercent: 15,
  price: 56_000,
  costUpdatedAt: Date.UTC(2026, 5, 2),
  createdAt: Date.UTC(2026, 1, 9),
  updatedAt: Date.UTC(2026, 5, 2),
}

/* The v3 → v4 upgrade transaction itself cannot run here (no IndexedDB), so the part of it that
 * decides what the rows LOOK LIKE is factored out into `backfillObservations` and executed for
 * real below. What the test cannot prove is that Dexie calls it; that is covered structurally by
 * 'carries an upgrade function on v4 only'. */
describe('v3 → v4 backfill', () => {
  it('writes exactly one observation per product and invents none', () => {
    expect(backfillObservations([v3Tea, v3Sugar])).toHaveLength(2)
    expect(backfillObservations([])).toEqual([])
  })

  it('builds each observation from the product’s own cost and costUpdatedAt', () => {
    const [tea, sugar] = backfillObservations([v3Tea, v3Sugar])
    expect(tea).toEqual({ productId: 1, cost: 100_000, observedAt: Date.UTC(2026, 2, 15), source: 'import' })
    expect(sugar).toEqual({ productId: 7, cost: 48_500, observedAt: Date.UTC(2026, 5, 2), source: 'import' })
  })

  it('dates the reading when the price was true, not when the upgrade ran', () => {
    const [tea] = backfillObservations([v3Tea])
    // `updatedAt` moved in September when the price was retargeted; the COST is from March.
    expect(tea!.observedAt).toBe(v3Tea.costUpdatedAt)
    expect(tea!.observedAt).not.toBe(v3Tea.updatedAt)
  })

  it('carries no id, so Dexie mints the keys itself', () => {
    for (const o of backfillObservations([v3Tea, v3Sugar])) {
      expect(Object.keys(o).sort()).toEqual(['cost', 'observedAt', 'productId', 'source'])
      expect('id' in o).toBe(false)
    }
  })

  it('leaves the products themselves untouched', () => {
    const before = JSON.stringify([v3Tea, v3Sugar])
    backfillObservations([v3Tea, v3Sugar])
    expect(JSON.stringify([v3Tea, v3Sugar])).toBe(before)
  })

  it('is safe to run twice: the same input yields the same rows, never a merged pair', () => {
    expect(backfillObservations([v3Tea, v3Sugar])).toEqual(backfillObservations([v3Tea, v3Sugar]))
  })
})

describe('a v1.3 backup file read by v1.4', () => {
  /* Byte-for-byte what v1.3.0's exporter produced: version 1, and no `observations` or
   * `storeProfile` key at all. This is the file sitting in a user's downloads folder. */
  const v1File = {
    app: 'sooda',
    version: 1,
    exportedAt: Date.UTC(2026, 5, 2),
    products: [v3Tea, v3Sugar],
    history: [v2Profit, v2Discount, v1Unitless],
    basket: [v2Profit],
    settings: { 'sooda:unit': 'toman' },
  }

  it('still validates, although the app now writes version 2', () => {
    expect(BACKUP_VERSION).toBe(2)
    const result = validateBackup(JSON.stringify(v1File))
    expect(result.ok).toBe(true)
  })

  it('reads the absent collections as empty rather than as a broken file', () => {
    const result = validateBackup(v1File)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.observations).toEqual([])
    expect(result.data.storeProfile).toBeNull()
    // …and everything v1.3 did carry comes back exactly as it went in.
    expect(result.data.products).toEqual([v3Tea, v3Sugar])
    expect(result.data.history).toEqual([v2Profit, v2Discount, v1Unitless])
    expect(result.data.version).toBe(1)
  })

  it('rejects a file from a build newer than this one', () => {
    expect(validateBackup({ ...v1File, version: 3 })).toEqual({ ok: false, problem: 'unsupportedVersion' })
  })
})
