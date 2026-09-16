/**
 * The backend the isolation proof stands on, checked against Dexie itself.
 *
 * A fake that quietly did nothing would make every later assertion pass for the wrong reason, so
 * this file proves the opposite: Dexie really opens it, really upgrades it, and every read the
 * sandbox depends on — including the compound-index range query the estimator uses — comes back
 * with the rows that were written.
 */

import Dexie, { type EntityTable } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { compareKeys, createFakeIndexedDb, type FakeIndexedDb } from './fakeIndexedDb'

interface Row {
  id: number
  productId: number
  cost: number
  observedAt: number
}

type TestDb = Dexie & { rows: EntityTable<Row, 'id'> }

function open(backend: FakeIndexedDb, name = 'fake-check'): TestDb {
  const db = new Dexie(name, {
    indexedDB: backend.indexedDB,
    IDBKeyRange: backend.IDBKeyRange,
  }) as TestDb
  db.version(1).stores({ rows: '++id, productId, observedAt, [productId+observedAt]' })
  return db
}

let backend: FakeIndexedDb

beforeEach(() => {
  backend = createFakeIndexedDb()
})

describe('key ordering', () => {
  it('orders number < date < string < array, as IndexedDB does', () => {
    const sorted = [['a'], 'a', new Date(0), 1].sort(compareKeys)
    expect(sorted).toEqual([1, new Date(0), 'a', ['a']])
  })

  it('compares arrays element by element, then by length', () => {
    expect(compareKeys([1, 2], [1, 3])).toBe(-1)
    expect(compareKeys([1], [1, 0])).toBe(-1)
    expect(compareKeys([1, 2], [1, 2])).toBe(0)
  })

  it('places Dexie’s own minKey below and maxKey above every stored key', () => {
    expect(compareKeys(-Infinity, 0)).toBe(-1)
    expect(compareKeys([[]], 'zzz')).toBe(1)
    expect(compareKeys([[]], [1, Number.MAX_SAFE_INTEGER])).toBe(1)
  })
})

describe('Dexie on the fake backend', () => {
  it('creates the database and its declared indexes', async () => {
    const db = open(backend)
    await db.open()
    expect(backend.factory.databaseNames()).toEqual(['fake-check'])
    expect(db.rows.schema.indexes.map((i) => i.name)).toEqual(['productId', 'observedAt', '[productId+observedAt]'])
    db.close()
  })

  it('round-trips rows through add, get, put, delete and count', async () => {
    const db = open(backend)
    const id = await db.rows.add({ productId: 1, cost: 100, observedAt: 10 } as Row)
    expect(id).toBe(1)
    expect(await db.rows.get(1)).toEqual({ id: 1, productId: 1, cost: 100, observedAt: 10 })
    await db.rows.update(1, { cost: 150 })
    expect((await db.rows.get(1))?.cost).toBe(150)
    await db.rows.add({ productId: 2, cost: 200, observedAt: 20 } as Row)
    expect(await db.rows.count()).toBe(2)
    await db.rows.delete(1)
    expect(await db.rows.count()).toBe(1)
    db.close()
  })

  it('serves the compound-index range query the estimator reads observations with', async () => {
    const db = open(backend)
    await db.rows.bulkAdd([
      { productId: 2, cost: 20, observedAt: 300 },
      { productId: 1, cost: 10, observedAt: 200 },
      { productId: 1, cost: 11, observedAt: 100 },
      { productId: 3, cost: 30, observedAt: 400 },
    ] as Row[])
    const mine = await db.rows
      .where('[productId+observedAt]')
      .between([1, Dexie.minKey], [1, Dexie.maxKey])
      .toArray()
    // Ordered by the index, oldest first — which is the ordering `listObservations` promises.
    expect(mine.map((r) => r.observedAt)).toEqual([100, 200])
    expect(mine.every((r) => r.productId === 1)).toBe(true)
    db.close()
  })

  it('deletes by a secondary index, and reverse-orders a query', async () => {
    const db = open(backend)
    await db.rows.bulkAdd([
      { productId: 1, cost: 10, observedAt: 100 },
      { productId: 1, cost: 11, observedAt: 200 },
      { productId: 2, cost: 20, observedAt: 300 },
    ] as Row[])
    expect(await db.rows.orderBy('observedAt').reverse().toArray()).toHaveLength(3)
    expect((await db.rows.orderBy('observedAt').reverse().first())?.observedAt).toBe(300)
    await db.rows.where('productId').equals(1).delete()
    expect((await db.rows.toArray()).map((r) => r.productId)).toEqual([2])
    db.close()
  })

  it('rolls a transaction back when it aborts, leaving nothing half-written', async () => {
    const db = open(backend)
    await db.rows.add({ productId: 1, cost: 10, observedAt: 100 } as Row)
    await expect(
      db.transaction('rw', db.rows, async () => {
        await db.rows.add({ productId: 9, cost: 90, observedAt: 900 } as Row)
        throw new Error('practice blew up')
      }),
    ).rejects.toThrow()
    expect(await db.rows.count()).toBe(1)
    db.close()
  })

  it('reports rows as plain data, independent of the objects Dexie handed back', async () => {
    const db = open(backend)
    await db.rows.add({ productId: 1, cost: 10, observedAt: 100 } as Row)
    const read = await db.rows.get(1)
    read!.cost = 999_999
    expect(backend.factory.rows('fake-check', 'rows')).toEqual([{ id: 1, productId: 1, cost: 10, observedAt: 100 }])
    db.close()
  })

  it('forgets the database once it is deleted', async () => {
    const db = open(backend)
    await db.rows.add({ productId: 1, cost: 10, observedAt: 100 } as Row)
    await db.delete()
    expect(backend.factory.databaseNames()).toEqual([])
  })

  it('logs every operation against the database it happened in', async () => {
    const db = open(backend)
    await db.rows.add({ productId: 1, cost: 10, observedAt: 100 } as Row)
    const ops = backend.factory.operations('fake-check')
    expect(ops.some((o) => o.op === 'open')).toBe(true)
    expect(ops.some((o) => o.op === 'add' && o.store === 'rows')).toBe(true)
    expect(backend.factory.operations('some-other-db')).toEqual([])
    db.close()
  })

  it('fails to open at all when storage is refused, without taking the process down', async () => {
    backend.factory.refuseStorage = true
    const db = open(backend, 'refused')
    await expect(db.open()).rejects.toThrow()
    db.close()
  })
})
