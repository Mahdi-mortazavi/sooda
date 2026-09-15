/**
 * The coach-side halves of the contracts frozen in `docs/v1.5-plan.md`.
 *
 * Type-only, so importing this costs nothing at runtime and nothing in any chunk.
 */

import type { Observation, Product, StoreProfile } from '../../lib/db'
import type { ResultDisplay } from '../../lib/modes/types'
import type { TourEvent } from './events'

/**
 * What the practice store exposes to a step's `expect`. Frozen in the plan; declared here
 * rather than imported from `src/learn/sandbox` so the coach does not depend on a sibling
 * agent's module graph. TypeScript is structural: the sandbox's own `SandboxState`
 * satisfies this one as long as both keep the shape the plan freezes.
 */
export interface SandboxState {
  products: Product[]
  observations: Observation[]
  profile: StoreProfile | null
  lastResult: ResultDisplay | null
}

/** Where a step can ask to be sent before it runs. */
export interface TourDestination {
  tab?: 'calculator' | 'products'
  sheet?: string
  mode?: string
}

export interface TourCtx {
  emit(event: TourEvent): void
  sandbox: SandboxState
  /** Opens a sheet, switches a tab — anything a step needs in place before it can run. */
  navigate(to: TourDestination): Promise<void>
}

/** One thing the ghost finger does. `target` is a `data-tour` value, like a step's. */
export type DemoAction = { target: string; type: 'tap' } | { target: string; type: 'type'; value: string }

export interface DemoScript {
  /** Replayed by «نشانم بده» with the ghost finger. */
  actions: DemoAction[]
}

export interface LessonStep {
  id: string
  target: string
  textKey: string
  placement?: 'auto' | 'top' | 'bottom'
  expect: (ev: TourEvent, state: SandboxState) => boolean
  demo?: DemoScript
  before?: (ctx: TourCtx) => void | Promise<void>
}
