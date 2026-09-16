/**
 * The practice database: a second, real Dexie store named `sooda-practice`, created when the
 * shopkeeper starts a lesson and deleted when they leave it (decision D1).
 *
 * It is a real Dexie instance and not an in-memory stand-in so that practice behaves exactly like
 * the app — live queries, transactions, auto-incrementing keys and all. The one thing that must
 * never be true of it is that it shares anything with the user's own data, so:
 *
 *  * the database has its own name, and nothing here reads or writes the real one;
 *  * this file names `../../lib/db` for TYPES ONLY, so the one place that decides which database
 *    is created cannot reach the real instance even by a typo. The repository next door does hold
 *    it — it runs the app's own logic, which binds itself to the real store at import time — so
 *    what actually proves the guarantee is `isolation.test.ts` watching every operation.
 */

import Dexie from 'dexie'
import type { SoodaDb } from '../../lib/db'

/** Never 'sooda'. A test asserts it, because a one-character slip here would erase a price list. */
export const PRACTICE_DB_NAME = 'sooda-practice'

/**
 * Byte-identical to the real v4 declaration in `src/lib/db.ts`.
 *
 * Only the final version is declared: a practice database is created empty and destroyed on the
 * way out, so it never has a v1, v2 or v3 row to upgrade. A test compares this map against the
 * real database's own v4 declaration and fails the moment either side moves.
 */
export const PRACTICE_STORES: Record<string, string> = {
  history: '++id, mode, createdAt',
  basket: '++id, createdAt',
  products: '++id, name, updatedAt, costUpdatedAt',
  observations: '++id, productId, observedAt, [productId+observedAt]',
  storeProfile: 'id',
}

export const PRACTICE_SCHEMA_VERSION = 4

/** A practice database IS a Sooda database — that is what lets the real repositories run on it. */
export type PracticeDb = SoodaDb

/** The browser storage the practice database runs on. Only tests pass it — the node test
 * environment has no IndexedDB, and the app must always use the one the browser gives it. */
export interface StorageBackend {
  indexedDB?: IDBFactory
  IDBKeyRange?: typeof IDBKeyRange
}

/**
 * Builds the practice database. Nothing is opened yet: Dexie opens on first use, and
 * `enterPractice` wants the failure of a browser that refuses storage in one predictable place.
 */
export function createPracticeDb(backend: StorageBackend = {}): PracticeDb {
  /* Each key is spread in only when it is set. Passing `indexedDB: undefined` would OVERWRITE
   * Dexie's own default with undefined and leave the database with no backend at all. */
  const db = new Dexie(PRACTICE_DB_NAME, {
    ...(backend.indexedDB === undefined ? {} : { indexedDB: backend.indexedDB }),
    ...(backend.IDBKeyRange === undefined ? {} : { IDBKeyRange: backend.IDBKeyRange }),
  }) as PracticeDb
  db.version(PRACTICE_SCHEMA_VERSION).stores(PRACTICE_STORES)
  return db
}

/**
 * Removes the practice database, whether or not this tab has it open.
 *
 * Never throws. Exit runs on the way out of a lesson, often while the user is already tapping
 * something else, and a browser that has taken storage away mid-session must not turn leaving a
 * tutorial into a crash — the same posture `ErrorBoundary` takes for the app as a whole.
 */
export async function destroyPracticeDb(db: PracticeDb | null, backend: StorageBackend = {}): Promise<boolean> {
  try {
    /* A Dexie instance deletes by name through its own backend, so a database left behind by a
     * session that was never exited (a closed tab, a crash) is deleted by a fresh instance too. */
    const target = db ?? createPracticeDb(backend)
    target.close()
    await target.delete()
    return true
  } catch {
    // storage refused, already gone, or blocked by another tab — the lesson is over either way
    return false
  }
}
