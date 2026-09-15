/**
 * Which database the app is writing to, as a value rather than as a module-level fact.
 *
 * `src/lib/products.ts` and `src/lib/observations.ts` bind their named exports to the real
 * `sooda` database at import time. A component that imports those bindings writes to the
 * shopkeeper's own price list no matter how isolated the practice store is — so the plan's
 * repository-injection rule says every component that writes products or observations reads its
 * repository from here instead, and `ui` hands it `session.repository` while a lesson is running.
 *
 * This file is type-only apart from `createContext`, so App can provide the context without
 * pulling either repository module (or Dexie, or the rate engine behind it) into the entry chunk.
 * The real default lives next door in `useRepository.ts`, which only lazy chunks import.
 */

import { createContext } from 'react'
import type { SoodaDb } from '../../lib/db'
import type { ObservationRepository } from '../../lib/observations'
import type { ProductRepository } from '../../lib/products'

/** Everything a component may do to products and their price history. */
export type AppRepository = ProductRepository & ObservationRepository

export interface RepositoryValue {
  repository: AppRepository
  /**
   * The same database the repository is bound to, for `useLiveQuery`. Components subscribe to
   * tables directly for reads; handing them the wrong one would show the demo shop's rows beside
   * the real shop's writes.
   */
  db: SoodaDb
  /**
   * Best-effort `navigator.storage.persist()`. A no-op during practice: a tutorial that trips
   * the browser's storage prompt has interrupted the lesson it was teaching.
   */
  persist(): Promise<boolean>
  /** True while a lesson is running against the practice store. */
  practice: boolean
}

/** `null` means "nothing is overriding it" — `useRepository` then answers with the real shop. */
export const RepositoryContext = createContext<RepositoryValue | null>(null)
