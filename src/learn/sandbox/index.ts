/**
 * The sandbox's whole public surface. `coach`, `lessons` and `ui` reach it with
 * `await import('../sandbox')` — never a static import, or the tutorial lands in the entry chunk.
 */

export { PRACTICE_DB_NAME, type PracticeDb } from './db'
export { buildSeed, SEED_PRODUCTS, SEED_PROFILE, type SeedData } from './seed'
export type { PracticeRepository } from './repository'
export {
  currentPractice,
  enterPractice,
  exitPractice,
  type EnterPracticeResult,
  type PracticeOptions,
  type PracticeSession,
} from './session'
export type { SandboxState } from './types'
