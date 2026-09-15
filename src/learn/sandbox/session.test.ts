/**
 * Entering and leaving practice: that the database appears, carries the demo shop, is identical in
 * shape to the real one, and is really gone afterwards — including when the browser has taken
 * storage away underneath the session.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db as realDb } from '../../lib/db'
import { PRACTICE_DB_NAME, PRACTICE_SCHEMA_VERSION, PRACTICE_STORES } from './db'
import { buildSeed, SEED_PRODUCTS } from './seed'
import { currentPractice, enterPractice, exitPractice, type PracticeOptions } from './session'
import { createFakeIndexedDb, type FakeIndexedDb } from './testing/fakeIndexedDb'

const NOW = Date.UTC(2026, 8, 15, 9, 0, 0)

let backend: FakeIndexedDb

function options(): PracticeOptions {
  return { now: NOW, indexedDB: backend.indexedDB, IDBKeyRange: backend.IDBKeyRange }
}

async function enter(): Promise<NonNullable<ReturnType<typeof currentPractice>>> {
  const result = await enterPractice(options())
  if (!result.ok) throw new Error('practice refused to start')
  return result.session
}

beforeEach(() => {
  backend = createFakeIndexedDb()
})

afterEach(async () => {
  await exitPractice()
})

describe('the practice database', () => {
  it('is never the real one', () => {
    expect(PRACTICE_DB_NAME).toBe('sooda-practice')
    expect(PRACTICE_DB_NAME).not.toBe(realDb.name)
  })

  /* Dexie decides whether to rebuild a store by diffing these exact strings, and the sandbox
   * claims to be the same shape as the real thing. If either side moves, this fails — which is
   * the only warning anyone will get that a v5 needs mirroring here. */
  it('declares byte-identically to the real database’s current version', () => {
    interface DeclaredVersion {
      _cfg: { version: number; storesSource: Record<string, string | null> }
    }
    const versions = (realDb as unknown as { _versions: DeclaredVersion[] })._versions
    const latest = versions[versions.length - 1]!
    expect(realDb.verno).toBe(PRACTICE_SCHEMA_VERSION)
    expect(latest._cfg.version).toBe(PRACTICE_SCHEMA_VERSION)
    expect(latest._cfg.storesSource).toEqual(PRACTICE_STORES)
  })

  it('resolves to the same five tables and indexes the real database has', async () => {
    const session = await enter()
    expect(session.db.tables.map((t) => t.name).sort()).toEqual([
      'basket',
      'history',
      'observations',
      'products',
      'storeProfile',
    ])
    expect(session.db.observations.schema.indexes.map((i) => i.name)).toEqual([
      'productId',
      'observedAt',
      '[productId+observedAt]',
    ])
    for (const table of session.db.tables) {
      expect(table.schema.primKey.keyPath).toBe('id')
      expect(table.schema.primKey.auto).toBe(table.name !== 'storeProfile')
    }
  })
})

describe('enterPractice', () => {
  it('creates the database and seeds the demo shop into it', async () => {
    const session = await enter()
    expect(backend.factory.databaseNames()).toEqual([PRACTICE_DB_NAME])
    const state = await session.readState()
    expect(state.products).toHaveLength(5)
    expect(state.observations.length).toBeGreaterThan(state.products.length)
    expect(state.profile?.categories[0]).toBe('food')
    expect(state.lastResult).toBeNull()
    expect(currentPractice()).toBe(session)
  })

  it('starts the history and basket empty — practice is a shop, not a session log', async () => {
    const session = await enter()
    expect(await session.db.history.count()).toBe(0)
    expect(await session.db.basket.count()).toBe(0)
  })

  it('dates the demo shop from the session clock, so a challenge answer cannot drift', async () => {
    const session = await enter()
    const seeded = buildSeed(NOW).products.find((p) => p.id === SEED_PRODUCTS.oil)
    expect(await session.db.products.get(SEED_PRODUCTS.oil)).toEqual(seeded)
  })

  /* A write made DURING the lesson is stamped by the app's own clock, not by the session's: the
   * practice repository is `createProductRepository` itself, which reads `Date.now()`, and running
   * the shop's real code is worth more than pinning a timestamp no challenge is computed from.
   * What a lesson does pass explicitly — `costUpdatedAt`, `observedAt` — is honoured exactly. */
  it('stamps a new row with the app’s clock, and honours the dates it is given', async () => {
    const session = await enter()
    const before = Date.now()
    const id = await session.repository.addProduct({
      name: 'چای سیاه ۵۰۰ گرمی',
      cost: 620_000,
      targetMarginPercent: 22,
      price: 760_000,
      costUpdatedAt: NOW,
    })
    const saved = await session.db.products.get(id)
    expect(saved?.createdAt).toBeGreaterThanOrEqual(before)
    expect(saved?.createdAt).toBeLessThanOrEqual(Date.now())
    // The date the caller supplied is the one the reading carries — that is what lessons rely on.
    expect(saved?.costUpdatedAt).toBe(NOW)
    const readings = await session.repository.listObservations(id)
    expect(readings[0]?.observedAt).toBe(NOW)
  })

  it('hands back the same session to a second tap while the first is still opening', async () => {
    const [a, b] = await Promise.all([enterPractice(options()), enterPractice(options())])
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.session).toBe(b.session)
    expect(await a.session.db.products.count()).toBe(5)
  })

  it('throws nothing when the browser refuses storage — practice is simply unavailable', async () => {
    backend.factory.refuseStorage = true
    const result = await enterPractice(options())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('storage')
    expect(currentPractice()).toBeNull()
    expect(backend.factory.databaseNames()).toEqual([])
  })

  it('discards a database left behind by a session that was never exited', async () => {
    const first = await enter()
    await first.repository.deleteProduct(SEED_PRODUCTS.rice)
    await first.repository.addProduct({
      name: 'کالای جامانده',
      cost: 1,
      targetMarginPercent: 1,
      price: 2,
      costUpdatedAt: NOW,
    })
    // The tab closed here: no exitPractice, the database is still on disk.
    const second = await enter()
    const state = await second.readState()
    expect(state.products).toHaveLength(5)
    expect(state.products.map((p) => p.id)).toContain(SEED_PRODUCTS.rice)
    expect(state.products.map((p) => p.name)).not.toContain('کالای جامانده')
  })
})

describe('exitPractice', () => {
  it('deletes the practice database and forgets the session', async () => {
    await enter()
    await exitPractice()
    expect(backend.factory.databaseNames()).toEqual([])
    expect(currentPractice()).toBeNull()
  })

  it('is safe to call twice', async () => {
    await enter()
    await exitPractice()
    await expect(exitPractice()).resolves.toBeUndefined()
    expect(backend.factory.databaseNames()).toEqual([])
  })

  it('is safe having never entered at all', async () => {
    await expect(exitPractice()).resolves.toBeUndefined()
    expect(backend.factory.operations(PRACTICE_DB_NAME)).toEqual([])
  })

  it('does not throw when storage disappears mid-session', async () => {
    await enter()
    backend.factory.refuseStorage = true
    await expect(exitPractice()).resolves.toBeUndefined()
    expect(currentPractice()).toBeNull()
  })

  it('leaves no trace for the next session to find', async () => {
    const first = await enter()
    await first.repository.recordCost({
      productId: SEED_PRODUCTS.oil,
      cost: 999_000,
      observedAt: NOW,
      source: 'checkin',
    })
    await exitPractice()
    const second = await enter()
    const oil = await second.db.products.get(SEED_PRODUCTS.oil)
    expect(oil?.cost).not.toBe(999_000)
    const readings = await second.db.observations.toArray()
    expect(readings.some((o) => o.cost === 999_000)).toBe(false)
  })
})
