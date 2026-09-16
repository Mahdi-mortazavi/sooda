/**
 * The practice shop's repository: the app's own product and observation logic, handed the practice
 * database instead of the real one.
 *
 * There is deliberately no implementation in this file. `createProductRepository` and
 * `createObservationRepository` are the code the shop runs, and a lesson has to run exactly that
 * code — the rule about which writes count as a new price reading is subtle enough that a copy
 * matching it today would drift from it tomorrow, and a lesson taught from the drifted copy would
 * be teaching something that is not true of the app.
 *
 * Note what this costs, because it changes where the isolation guarantee comes from. Importing
 * those two modules pulls the real `sooda` Dexie instance into the practice module graph: each of
 * them binds its own named exports to the real database at import time. Constructing a Dexie
 * instance opens nothing and touches no storage, so no operation reaches the real database — but
 * "the sandbox cannot name the real store" is no longer the argument. What proves it now is
 * `isolation.test.ts`, which watches every operation both databases receive.
 */

import { createObservationRepository, type ObservationRepository } from '../../lib/observations'
import { createProductRepository, type ProductRepository } from '../../lib/products'
import type { PracticeDb } from './db'

/** Everything a lesson may do to the demo shop: the two real repositories, with nothing added. */
export type PracticeRepository = ProductRepository & ObservationRepository

/**
 * Binds the app's repositories to the practice database.
 *
 * Timestamps are the app's: `createdAt`, `updatedAt` and a missing `observedAt` are stamped from
 * `Date.now()` inside the real logic, not from the session's pinned clock. The seed is what has to
 * be reproducible for a challenge answer, and it is; see `PracticeOptions.now`.
 */
export function createPracticeRepository(db: PracticeDb): PracticeRepository {
  return { ...createProductRepository(db), ...createObservationRepository(db) }
}
