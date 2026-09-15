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
  /**
   * Re-reads the practice store. This is what `TourCtx.refreshSandbox()` awaits, and the plan's
   * refresh rule says the coach awaits it before evaluating any `expect` — a step whose condition
   * is "a product now exists" must not be judged against a snapshot taken before the write landed.
   */
  readState(): Promise<SandboxState>
  /** The last state read, with no database access: `TourCtx.sandbox` between two refreshes. */
  snapshot(): SandboxState
  /** The result card a mode last produced in practice. View state, never stored. */
  setLastResult(result: ResultDisplay | null): void
}

export type EnterPracticeResult =
  | { ok: true; session: PracticeSession }
  /** The browser refuses to store anything — private mode, a locked-down profile, a full disk. */
  | { ok: false; reason: 'storage'; error: unknown }
  /** `exitPractice()` was called while this one was still opening. Nothing to report to the user. */
  | { ok: false; reason: 'cancelled' }

let active: PracticeSession | null = null
let entering: Promise<EnterPracticeResult> | null = null
/* Bumped by every exit. An enter that was still opening when the user backed out finds its own
 * generation stale and tears the database down instead of handing back a session nobody asked
 * for any more. */
let generation = 0

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
  generation++
  if (session === null) return
  await destroyPracticeDb(session.db)
}

async function openSession(options: PracticeOptions): Promise<EnterPracticeResult> {
  await exitPractice()
  const opening = generation
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

  if (generation !== opening) {
    // Backed out while this was opening: leave exactly as little behind as a normal exit would.
    await destroyPracticeDb(db, backend)
    return { ok: false, reason: 'cancelled' }
  }

  const session = createSession(db, now, clock)
  // Read once here, so `snapshot()` shows the demo shop before the first step has run.
  await session.readState()
  active = session
  return { ok: true, session }
}

function createSession(db: PracticeDb, now: number, clock: () => number): PracticeSession {
  let cached: SandboxState = { products: [], observations: [], profile: null, lastResult: null }
  return {
    db,
    repository: createPracticeRepository(db, clock),
    now,
    async readState(): Promise<SandboxState> {
      try {
        const [products, observations, profile] = await Promise.all([
          db.products.toArray(),
          db.observations.toArray(),
          db.storeProfile.get('me'),
        ])
        cached = { products, observations, profile: profile ?? null, lastResult: cached.lastResult }
      } catch {
        /* The database is gone — practice was exited while this read was in flight, or storage
         * was taken away. A step's `expect` seeing an empty shop is a step that does not advance;
         * a rejected promise here would be an unhandled crash in the middle of a render. */
        cached = { products: [], observations: [], profile: null, lastResult: cached.lastResult }
      }
      return cached
    },
    snapshot(): SandboxState {
      return cached
    },
    setLastResult(result): void {
      // A new object, so a step holding the previous snapshot is not mutated underneath it.
      cached = { ...cached, lastResult: result }
    },
  }
}
