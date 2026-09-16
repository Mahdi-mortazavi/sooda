/**
 * The frozen sandbox contract from `docs/v1.5-plan.md`. The coach reads this shape and no other,
 * so a lesson step never learns whether it is looking at the practice shop or the real one.
 */

import type { Observation, Product, StoreProfile } from '../../lib/db'
import type { ResultDisplay } from '../../lib/modes/types'

export interface SandboxState {
  products: Product[]
  observations: Observation[]
  profile: StoreProfile | null
  lastResult: ResultDisplay | null
}
