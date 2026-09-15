/**
 * The repository a component should use: the practice store while a lesson is running, the real
 * shop otherwise.
 *
 * The real value is built here rather than in `repositoryContext.ts` on purpose. Building it
 * needs `lib/products` and `lib/observations`, which drag Dexie and the rate engine with them;
 * this module is imported only by lazy component chunks that already load those, so first paint
 * pays nothing for it while App can still provide the context.
 */

import { useContext } from 'react'
import { db } from '../../lib/db'
import { createObservationRepository } from '../../lib/observations'
import { createProductRepository, requestPersistentStorage } from '../../lib/products'
import { RepositoryContext, type RepositoryValue } from './repositoryContext'

/* The shop itself. One instance for the whole app: the factories close over the database and
 * hold no state of their own, so there is nothing to keep in sync. */
const REAL: RepositoryValue = {
  repository: { ...createProductRepository(db), ...createObservationRepository(db) },
  db,
  persist: requestPersistentStorage,
  practice: false,
  pinned: null,
}

export function useRepository(): RepositoryValue {
  return useContext(RepositoryContext) ?? REAL
}

export type { AppRepository, RepositoryValue } from './repositoryContext'
