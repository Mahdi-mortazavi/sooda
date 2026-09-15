/**
 * THE guarantee: a practice session touches nothing of the user's.
 *
 * The plan puts it in one sentence — "during practice nothing reads or writes the real `history`,
 * `basket`, `products`, `observations`, `storeProfile`, the draft, the badge count, or a share
 * link" — and this file is where that sentence is made falsifiable. Both databases run for real,
 * on the in-memory IndexedDB in `testing/fakeIndexedDb.ts`, and the backend records every single
 * operation with the database it happened in. So the assertions are not "we did not mean to touch
 * it": they are the full log of what was touched, and the raw bytes of the real store before and
 * after.
 *
 * Four independent things are checked, because any one of them alone could pass for a bad reason:
 *
 *  1. the operation log for `sooda` is EMPTY — this catches a read, which no snapshot comparison
 *     ever could, and it catches a write-then-write-back;
 *  2. the real Dexie instance was never even opened;
 *  3. every real table is byte-identical, read straight out of storage rather than through Dexie;
 *  4. localStorage, the basket-count broadcast and the app badge saw no calls at all.
 *
 * And then the guard is turned on itself: 'a breach is caught' does the very thing a careless
 * sandbox would do and proves each check above goes red. Without that test, all of this could be
 * passing because the machinery measures nothing.
 *
 * Every import that reaches Dexie is dynamic, and deliberately so: the real `src/lib/db.ts` picks
 * its IndexedDB up from the global scope when the module first loads, so the fake backend has to
 * be installed before that happens. A static import would be hoisted above the install.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeIndexedDb } from './testing/fakeIndexedDb'

/* ── the browser, as far as this test is concerned ──────────────────────── */

const backend = createFakeIndexedDb()
const factory = backend.factory

interface SpyCall {
  api: string
  key?: string
}

/** Every localStorage call, the draft and the basket-count mirror included. */
const storageCalls: SpyCall[] = []
/** Every event the app broadcast — `sooda:basket-count` is the one that matters. */
const dispatched: string[] = []
/** Every app-badge call. */
const badgeCalls: string[] = []

const storageBacking = new Map<string, string>()
const fakeLocalStorage = {
  getItem(key: string): string | null {
    storageCalls.push({ api: 'getItem', key })
    return storageBacking.get(key) ?? null
  },
  setItem(key: string, value: string): void {
    storageCalls.push({ api: 'setItem', key })
    storageBacking.set(key, value)
  },
  removeItem(key: string): void {
    storageCalls.push({ api: 'removeItem', key })
    storageBacking.delete(key)
  },
  clear(): void {
    storageCalls.push({ api: 'clear' })
    storageBacking.clear()
  },
  key(index: number): string | null {
    storageCalls.push({ api: 'key' })
    return [...storageBacking.keys()][index] ?? null
  },
  get length(): number {
    storageCalls.push({ api: 'length' })
    return storageBacking.size
  },
}

function define(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

define('indexedDB', backend.indexedDB)
define('IDBKeyRange', backend.IDBKeyRange)
define('localStorage', fakeLocalStorage)
define('window', {
  dispatchEvent(event: { type: string }): boolean {
    dispatched.push(event.type)
    return true
  },
  addEventListener(): void {},
  removeEventListener(): void {},
})
Object.defineProperty(navigator, 'setAppBadge', {
  value: async (): Promise<void> => {
    badgeCalls.push('setAppBadge')
  },
  configurable: true,
})
Object.defineProperty(navigator, 'clearAppBadge', {
  value: async (): Promise<void> => {
    badgeCalls.push('clearAppBadge')
  },
  configurable: true,
})

/* Loaded only now, with the fake backend already in the global scope. */
const { db: realDb, BASKET_COUNT_KEY } = await import('../../lib/db')
const realProducts = await import('../../lib/products')
const realObservations = await import('../../lib/observations')
const { DRAFT_STORAGE_KEY, writeDraft } = await import('../../lib/drafts')
const { PRACTICE_DB_NAME } = await import('./db')
const { buildPracticeBackup } = await import('./backup')
const { SEED_PRODUCTS } = await import('./seed')
const { enterPractice, exitPractice, currentPractice } = await import('./session')

/* ── the user's own shop, which must survive all of this untouched ──────── */

const NOW = Date.UTC(2026, 8, 15, 9, 0, 0)
const REAL_TABLES = ['history', 'basket', 'products', 'observations', 'storeProfile'] as const

const REAL_PRODUCTS = [
  {
    id: 1,
    name: 'پنیر لیقوان',
    cost: 480_000,
    targetMarginPercent: 20,
    price: 585_000,
    unit: 'toman' as const,
    costUpdatedAt: Date.UTC(2026, 6, 1),
    category: 'food' as const,
    createdAt: Date.UTC(2026, 2, 3),
    updatedAt: Date.UTC(2026, 6, 1),
  },
  {
    id: 2,
    name: 'کره حیوانی ۵۰۰ گرمی',
    cost: 910_000,
    targetMarginPercent: 12,
    price: 1_030_000,
    unit: 'toman' as const,
    costUpdatedAt: Date.UTC(2026, 7, 12),
    category: 'food' as const,
    createdAt: Date.UTC(2026, 1, 20),
    updatedAt: Date.UTC(2026, 7, 12),
  },
]

const REAL_OBSERVATIONS = [
  { id: 1, productId: 1, cost: 430_000, observedAt: Date.UTC(2026, 2, 3), source: 'save' as const },
  { id: 2, productId: 1, cost: 480_000, observedAt: Date.UTC(2026, 6, 1), source: 'update' as const },
  { id: 3, productId: 2, cost: 910_000, observedAt: Date.UTC(2026, 7, 12), source: 'checkin' as const },
]

const REAL_HISTORY = [
  {
    id: 1,
    mode: 'profit' as const,
    inputs: [480_000, 20],
    results: [576_000, 96_000],
    unit: 'toman' as const,
    createdAt: Date.UTC(2026, 6, 1, 8),
  },
]

const REAL_BASKET = [
  {
    id: 1,
    mode: 'sell' as const,
    inputs: [910_000, 1_030_000],
    results: [13.2, 120_000],
    unit: 'toman' as const,
    createdAt: Date.UTC(2026, 7, 12, 10),
  },
]

const REAL_PROFILE = { id: 'me' as const, categories: ['food' as const], importDependency: 0.5 as const }

/** Writes the user's shop through Dexie, then closes it: from here on nothing should reopen it. */
async function seedRealShop(): Promise<void> {
  await realDb.open()
  await realDb.transaction(
    'rw',
    realDb.history,
    realDb.basket,
    realDb.products,
    realDb.observations,
    realDb.storeProfile,
    async () => {
      await realDb.history.bulkAdd(REAL_HISTORY)
      await realDb.basket.bulkAdd(REAL_BASKET)
      await realDb.products.bulkAdd(REAL_PRODUCTS)
      await realDb.observations.bulkAdd(REAL_OBSERVATIONS)
      await realDb.storeProfile.put(REAL_PROFILE)
    },
  )
  realDb.close()
}

/** Straight out of storage — not through Dexie, which would itself be an access to the real store. */
function realBytes(): string {
  const tables: Record<string, unknown[]> = {}
  for (const table of REAL_TABLES) tables[table] = factory.rows('sooda', table)
  return JSON.stringify(tables)
}

function resetSpies(): void {
  factory.clearLog()
  storageCalls.length = 0
  dispatched.length = 0
  badgeCalls.length = 0
}

beforeEach(async () => {
  await exitPractice()
  realDb.close()
  await realDb.delete()
  storageBacking.clear()
  resetSpies()
})

/**
 * Everything a lesson makes the shopkeeper do: look at the shelf, add a product, record a purchase
 * price, reprice the whole list in bulk, undo part of it, and read the state back out.
 */
async function runFullPracticeSession(): Promise<{ productCount: number; observationCount: number }> {
  const entered = await enterPractice({
    now: NOW,
    indexedDB: backend.indexedDB,
    IDBKeyRange: backend.IDBKeyRange,
  })
  if (!entered.ok) throw new Error('practice refused to start')
  const { session } = entered
  const repo = session.repository

  // Lesson 1 — read the shelf.
  const opening = await session.readState()
  expect(opening.products).toHaveLength(5)

  // Lesson 2 — save a product.
  const teaId = await repo.addProduct({
    name: 'چای سیاه ۵۰۰ گرمی',
    cost: 620_000,
    targetMarginPercent: 22,
    price: 760_000,
    unit: 'toman',
    costUpdatedAt: NOW,
    category: 'food',
  })

  // Lesson 3 — record what the last delivery actually cost.
  await repo.recordCost({ productId: SEED_PRODUCTS.oil, cost: 178_000, observedAt: NOW, source: 'checkin' })
  await repo.setObservationExcluded(1, true)
  expect(await repo.listObservations(SEED_PRODUCTS.oil)).toHaveLength(4)

  // Lesson 4 — reprice the whole list, through the app's own pure engine.
  const products = await repo.listProducts()
  const snapshot = products.map((p) => ({ ...p }))
  const preview = realProducts.previewBulk(products, { kind: 'costUp', percent: 5 }, 1000, 3, NOW)
  const applied = await repo.bulkApply(
    preview.map((row) => ({ id: row.id, price: row.newPrice, cost: row.newCost, costUpdatedAt: NOW })),
  )
  expect(applied.observationIds.length).toBeGreaterThan(0)

  // …and take it back again, which is the undo the products screen offers.
  await repo.restoreProducts(snapshot, applied.observationIds)

  // Lesson 5 — take a backup. The app's own exporter would have read the real shop AND every
  // `sooda:` key in localStorage; the practice one must read neither.
  const file = await buildPracticeBackup(session.db, NOW)
  expect(file.products).toHaveLength(6)
  expect(file.settings).toEqual({})

  // Lesson 6 — the store profile, and a result on the card.
  await repo.writeStoreProfile({ id: 'me', categories: ['food', 'auto'], importDependency: 1 })
  session.setLastResult({
    key: 'profit',
    primaryLabel: 'سود',
    primaryValue: 140_000,
    secondaryLabel: 'درصد',
    secondaryValue: 22,
    isLoss: false,
    copyText: 'سود ۱۴۰٬۰۰۰ تومان',
  })

  const closing = await session.readState()
  expect(closing.products).toHaveLength(6)
  expect(closing.products.some((p) => p.id === teaId)).toBe(true)
  expect(closing.profile?.categories).toEqual(['food', 'auto'])
  expect(closing.lastResult?.primaryValue).toBe(140_000)

  await exitPractice()
  return { productCount: closing.products.length, observationCount: closing.observations.length }
}

describe('a full practice session', () => {
  it('leaves every real table byte-identical, and leaves no practice database behind', async () => {
    await seedRealShop()
    writeDraft({ modes: { profit: { cost: '480000' } }, mode: 'profit', tab: 'calculator' })
    const draftBefore = storageBacking.get(DRAFT_STORAGE_KEY)
    storageBacking.set(BASKET_COUNT_KEY, '1')
    const before = realBytes()
    resetSpies()

    const done = await runFullPracticeSession()

    // 1 — not one operation against the real database. This catches a READ, which no
    //     before/after comparison can.
    expect(factory.operations('sooda')).toEqual([])
    // 2 — it was never even opened.
    expect(realDb.isOpen()).toBe(false)
    // 3 — the bytes in storage are the same bytes.
    expect(realBytes()).toBe(before)
    // 4 — no draft, no basket-count mirror, no badge, no broadcast.
    expect(storageCalls).toEqual([])
    expect(dispatched).toEqual([])
    expect(badgeCalls).toEqual([])
    expect(storageBacking.get(DRAFT_STORAGE_KEY)).toBe(draftBefore)
    expect(storageBacking.get(BASKET_COUNT_KEY)).toBe('1')
    // …and the practice database is gone, with the user's still there.
    expect(factory.databaseNames()).toEqual(['sooda'])
    expect(currentPractice()).toBeNull()

    // The session has to have actually done something, or none of the above means anything.
    expect(done.productCount).toBe(6)
    expect(done.observationCount).toBeGreaterThan(13)
    const practiceOps = factory.operations(PRACTICE_DB_NAME)
    expect(practiceOps.filter((o) => o.op === 'add' || o.op === 'put').length).toBeGreaterThan(10)
    expect(practiceOps.some((o) => o.store === 'products' && o.mode === 'readwrite')).toBe(true)
  })

  it('reports the real shop unchanged through the app’s own readers, too', async () => {
    await seedRealShop()
    await runFullPracticeSession()
    // Reading the real database is only allowed once practice is over — this is the app resuming.
    await realDb.open()
    expect(await realProducts.listProducts()).toEqual(REAL_PRODUCTS)
    expect(await realObservations.listAllObservations()).toEqual(REAL_OBSERVATIONS)
    expect(await realObservations.readStoreProfile()).toEqual(REAL_PROFILE)
    expect(await realDb.history.toArray()).toEqual(REAL_HISTORY)
    expect(await realDb.basket.toArray()).toEqual(REAL_BASKET)
    realDb.close()
  })

  it('never opens the real database even when practice starts before the app has', async () => {
    // No seedRealShop: the user has never saved anything. Practice must not create `sooda` either.
    await runFullPracticeSession()
    expect(factory.databaseNames()).toEqual([])
    expect(factory.operations('sooda')).toEqual([])
  })

  it('survives a session that is abandoned rather than exited, still touching nothing', async () => {
    await seedRealShop()
    const before = realBytes()
    resetSpies()
    const entered = await enterPractice({
      now: NOW,
      indexedDB: backend.indexedDB,
      IDBKeyRange: backend.IDBKeyRange,
    })
    expect(entered.ok).toBe(true)
    if (!entered.ok) return
    await entered.session.repository.deleteProduct(SEED_PRODUCTS.rice)
    // The tab is closed here. The next `enterPractice` discards the leftovers; the real shop is
    // untouched in the meantime.
    expect(factory.operations('sooda')).toEqual([])
    expect(realBytes()).toBe(before)
    await exitPractice()
  })
})

describe('the guard itself', () => {
  /* If this test ever fails, every other assertion in this file is worthless: it would mean the
   * checks above cannot see a real-database access even when one happens on purpose. */
  it('catches a breach: doing to the real shop exactly what practice must not', async () => {
    await seedRealShop()
    const before = realBytes()
    resetSpies()

    await realDb.open()
    await realProducts.addProduct({
      name: 'کالای نشتی',
      cost: 1_000,
      targetMarginPercent: 10,
      price: 1_100,
      costUpdatedAt: NOW,
    })
    await realObservations.listAllObservations()
    await realDb.basket.add({
      mode: 'sell',
      inputs: [1, 2],
      results: [3, 4],
      createdAt: NOW,
    } as Parameters<typeof realDb.basket.add>[0])

    // 1 — the log sees it…
    expect(factory.operations('sooda')).not.toEqual([])
    expect(factory.operations('sooda').some((o) => o.store === 'products' && o.op === 'add')).toBe(true)
    // …including the pure READ, which changed nothing.
    expect(factory.operations('sooda').some((o) => o.store === 'observations' && o.op === 'openCursor')).toBe(true)
    // 2 — the database is open.
    expect(realDb.isOpen()).toBe(true)
    // 3 — and the bytes moved.
    expect(realBytes()).not.toBe(before)
    realDb.close()
  })

  it('catches a breach of the badge and the basket-count mirror', async () => {
    await seedRealShop()
    resetSpies()
    await realDb.open()
    const { addBasketItem } = await import('../../lib/db')
    await addBasketItem({ mode: 'sell', inputs: [1, 2], results: [3, 4], createdAt: NOW })
    const { setStaleBadge } = await import('../../lib/badge')
    await setStaleBadge(3)

    expect(storageCalls.some((c) => c.api === 'setItem' && c.key === BASKET_COUNT_KEY)).toBe(true)
    expect(dispatched).toContain('sooda:basket-count')
    expect(badgeCalls).toEqual(['setAppBadge'])
    realDb.close()
  })
})

describe('the sandbox module graph', () => {
  /* The strongest isolation there is: the practice code cannot write to the real database because
   * it does not have it. Only types cross the line, and types are erased. */
  it('never imports the real database module as a value', async () => {
    /* Read as text rather than imported, so the check is on what the file SAYS. A module graph
     * walked at runtime would already have had its type imports erased by the compiler. */
    const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
      string,
      string
    >
    const files = Object.keys(sources).filter((name) => !name.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThan(3)

    const seen: string[] = []
    const offenders: string[] = []
    for (const name of files) {
      const source = sources[name] ?? ''
      for (const line of source.split('\n')) {
        if (!/from '\.\.\/\.\.\/lib\/db'/.test(line)) continue
        seen.push(`${name}: ${line.trim()}`)
        // Anything from lib/db must be a type; types are erased, values are not.
        if (!line.startsWith('import type ')) offenders.push(`${name}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
    // The scan has to have found the imports it is judging, or it proves nothing.
    expect(seen.length).toBeGreaterThan(0)
  })
})
