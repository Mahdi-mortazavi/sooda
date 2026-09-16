/**
 * The coach-side halves of the contracts frozen in `docs/v1.5-plan.md`.
 *
 * Type-only, so importing this costs nothing at runtime and nothing in any chunk.
 */

import type { Observation, Product, StoreProfile } from '../../lib/db'
import type { ResultDisplay } from '../../lib/modes/types'
import type { TourEvent } from './events'
import type { Placement } from './geometry'

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
  /** A synchronously-readable snapshot. `refreshSandbox` below is what keeps it honest. */
  sandbox: SandboxState
  /**
   * Re-reads the practice store into `sandbox`. Coach awaits this before evaluating `expect`
   * for any event, so a step may treat `state` as current as of the event it is judging.
   */
  refreshSandbox(): Promise<void>
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
  /** `start`/`end` are logical sides, for a wide short target in a horizontal row. */
  placement?: Placement
  expect: (ev: TourEvent, state: SandboxState) => boolean
  demo?: DemoScript
  before?: (ctx: TourCtx) => void | Promise<void>
}
