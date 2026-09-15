/**
 * Entering and leaving practice mode.
 *
 * A session is a practice database plus the clock it is pinned to. Entering creates and seeds it;
 * leaving deletes it. Neither reads nor writes the user's own data, their draft, the basket count
 * mirror in localStorage or the app badge — `isolation.test.ts` is where that is proved rather
 * than asserted in prose.
 *
 * Nothing here may end up in the entry chunk: the tutorial is a `await import()` away, because a
 * shopkeeper who never opens a lesson should not pay a byte for one.
 */

import type { ResultDisplay } from '../../lib/modes/types'
import { createPracticeDb, destroyPracticeDb, type PracticeDb, type StorageBackend } from './db'
import { createPracticeRepository, type PracticeRepository } from './repository'
import { seedPractice } from './seed'
import type { SandboxState } from './types'

export interface PracticeOptions extends StorageBackend {
  /**
   * Pins the whole session — the seed's dates AND every write's timestamp — to this instant, so a
   * challenge has the same answer every time it is taken. Left out, the seed is dated from the
   * moment practice started and later writes use the real clock, exactly as the app does.
   */
  now?: number
}

export interface PracticeSession {
  /** The live practice database. Components may subscribe to it with `useLiveQuery`. */
  readonly db: PracticeDb
  /** Everything a lesson is allowed to do to the demo shop. */
  readonly repository: PracticeRepository
  /** The instant the demo shop is dated from. */
  readonly now: number
  /** The frozen `SandboxState` the coach hands to each step's `expect`. */
  readState(): Promise<SandboxState>
  /** The result card a mode last produced in practice. View state, never stored. */
  setLastResult(result: ResultDisplay | null): void
}

export type EnterPracticeResult =
  | { ok: true; session: PracticeSession }
  /** The browser refuses to store anything — private mode, a locked-down profile, a full disk. */
  | { ok: false; reason: 'storage'; error: unknown }

let active: PracticeSession | null = null
let entering: Promise<EnterPracticeResult> | null = null

/** The session in progress, or null. Synchronous, so a render can ask it. */
export function currentPractice(): PracticeSession | null {
  return active
}

/**
 * Creates the practice database, seeds the demo shop into it and returns the session.
 *
 * Never throws. A browser that refuses storage comes back as `{ ok: false }` and the caller shows
 * the "practice needs storage" message; it must not take the app down with it, which is the same
 * line `ErrorBoundary` draws for v1.4.1.
 */
export async function enterPractice(options: PracticeOptions = {}): Promise<EnterPracticeResult> {
  // Two taps on «تمرین» must not race each other into two half-seeded databases.
  if (entering !== null) return entering
  const run = openSession(options)
  entering = run
  try {
    return await run
  } finally {
    entering = null
  }
}

/**
 * Ends practice and deletes the database.
 *
 * Safe to call twice, safe to call having never entered, and safe when storage has gone away
 * underneath the session: leaving a lesson is not a moment at which to throw at the user.
 */
export async function exitPractice(): Promise<void> {
  const session = active
  /* Cleared before the await, so a second call — or a component unmounting into the same
   * teardown — finds nothing to do rather than deleting the database twice. */
  active = null
  if (session === null) return
  await destroyPracticeDb(session.db)
}

async function openSession(options: PracticeOptions): Promise<EnterPracticeResult> {
  await exitPractice()
  const backend: StorageBackend = {
    ...(options.indexedDB === undefined ? {} : { indexedDB: options.indexedDB }),
    ...(options.IDBKeyRange === undefined ? {} : { IDBKeyRange: options.IDBKeyRange }),
  }
  const pinned = options.now
  const now = pinned ?? Date.now()
  const clock = pinned === undefined ? Date.now : (): number => pinned

  let db: PracticeDb | null = null
  try {
    /* A database left behind by a session that was never exited — a closed tab, a crash — would
     * otherwise be reopened with last time's practice in it, and the first screen of the lesson
     * would not match what the lesson says. */
    await destroyPracticeDb(null, backend)
    db = createPracticeDb(backend)
    await db.open()
    await seedPractice(db, now)
  } catch (error) {
    await destroyPracticeDb(db, backend)
    return { ok: false, reason: 'storage', error }
  }

  active = createSession(db, now, clock)
  return { ok: true, session: active }
}

function createSession(db: PracticeDb, now: number, clock: () => number): PracticeSession {
  let lastResult: ResultDisplay | null = null
  return {
    db,
    repository: createPracticeRepository(db, clock),
    now,
    async readState(): Promise<SandboxState> {
      const [products, observations, profile] = await Promise.all([
        db.products.toArray(),
        db.observations.toArray(),
        db.storeProfile.get('me'),
      ])
      return { products, observations, profile: profile ?? null, lastResult }
    },
    setLastResult(result): void {
      lastResult = result
    },
  }
}
