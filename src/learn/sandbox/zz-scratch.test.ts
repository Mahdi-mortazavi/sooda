import { describe, expect, it } from 'vitest'
import { createFakeIndexedDb } from './testing/fakeIndexedDb'

const backend = createFakeIndexedDb()
Object.defineProperty(globalThis, 'indexedDB', { value: backend.indexedDB, configurable: true, writable: true })
Object.defineProperty(globalThis, 'IDBKeyRange', { value: backend.IDBKeyRange, configurable: true, writable: true })
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 },
  configurable: true, writable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} },
  configurable: true, writable: true,
})

const { enterPractice, exitPractice } = await import('./session')
const { PRACTICE_DB_NAME } = await import('./db')

describe('undo after exit', () => {
  it('shows what a stale repository handle does after the session is gone', async () => {
    const entered = await enterPractice({ indexedDB: backend.indexedDB, IDBKeyRange: backend.IDBKeyRange })
    if (!entered.ok) throw new Error('no session')
    const repo = entered.session.repository
    const products = await repo.listProducts()
    const snapshot = products.map((p) => ({ ...p }))
    const applied = await repo.bulkApply(products.map((p) => ({ id: p.id, price: p.price + 1000, cost: p.cost + 500, costUpdatedAt: Date.now() })))
    expect(applied.observationIds.length).toBeGreaterThan(0)

    await exitPractice()
    expect(backend.factory.databaseNames()).not.toContain(PRACTICE_DB_NAME)

    let error: unknown = null
    try {
      await repo.restoreProducts(snapshot, applied.observationIds)
    } catch (e) {
      error = e
    }
    console.log('RESTORE ERROR:', error === null ? 'none (it succeeded)' : String(error).slice(0, 200))
    console.log('DB NAMES AFTER UNDO:', JSON.stringify(backend.factory.databaseNames()))
    console.log('PRACTICE ROWS AFTER UNDO:', backend.factory.rows(PRACTICE_DB_NAME, 'products').length)
  })
})
