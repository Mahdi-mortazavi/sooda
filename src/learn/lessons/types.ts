/**
 * What a lesson is.
 *
 * The step itself is the coach's `LessonStep`; everything here either narrows it (so a target
 * that `ui` has not been asked for cannot be typed by accident) or wraps it (title, challenge,
 * how long the thing takes). Type-only apart from the unions, so importing it costs nothing.
 */

import type { ProfitStatus } from '../../lib/inflation'
import type { TourEvent } from '../coach/events'
import type { LessonStep, SandboxState } from '../coach/types'
import type { TourTargetName } from './targets'

export type LessonId =
  | 'profit'
  | 'discount'
  | 'realProfit'
  | 'installments'
  | 'products'
  | 'smartRates'
  | 'everyday'
  | 'safety'

/** A ghost-finger action, restricted to targets `ui` has actually been asked for. */
export type LessonDemoAction =
  | { target: TourTargetName; type: 'tap' }
  | { target: TourTargetName; type: 'type'; value: string }

export interface LessonDemo {
  actions: LessonDemoAction[]
}

/**
 * A step, with two things tightened: the target must be a known `data-tour` name, and the demo is
 * required. «نشانم بده» has to be able to finish any lesson unaided — a step with no demo is a
 * dead end for a user who is stuck, and the browser smoke test drives a whole lesson this way.
 */
export interface LessonStepSpec extends Omit<LessonStep, 'target' | 'demo'> {
  target: TourTargetName
  demo: LessonDemo
}

export interface ChallengeOption {
  id: string
  labelKey: string
  correct: boolean
}

interface ChallengeBase {
  /** Unique within its lesson; the text key is `learn.<lessonId>.challenge.<id>`. */
  id: string
  promptKey: string
  /** Where to point while the challenge is open, when it asks for something to be done. */
  target?: TourTargetName
}

/** Type a figure. `answer` always comes from the engine — see `expected.source.ts`. */
export interface NumberChallenge extends ChallengeBase {
  kind: 'number'
  answer: number
  /** Accepted distance from `answer`, in the same unit; never a fudge for a wrong answer. */
  tolerance: number
  unit: 'money' | 'percent'
}

/** Pick a verdict. Which option is `correct` is decided by the engine, not by the author. */
export interface ChoiceChallenge extends ChallengeBase {
  kind: 'choice'
  options: ChallengeOption[]
}

/** Do it in the practice shop. Judged exactly like a step: on an event, against fresh state. */
export interface TaskChallenge extends ChallengeBase {
  kind: 'task'
  target: TourTargetName
  done: (ev: TourEvent, state: SandboxState) => boolean
  demo: LessonDemo
}

export type Challenge = NumberChallenge | ChoiceChallenge | TaskChallenge

export interface Lesson {
  id: LessonId
  titleKey: string
  summaryKey: string
  /** Seconds a real user needs, honestly estimated. The plan caps a lesson at 90. */
  estimateSeconds: number
  /** The lesson's figures assume the pinned tutorial rate, so the note has to be on screen. */
  showsRate: boolean
  steps: LessonStepSpec[]
  challenges: Challenge[]
}

/* ── what the engine computes for the challenges ──────────────────────── */

/**
 * Every figure a challenge checks an answer against.
 *
 * `expected.source.ts` computes these from the real engine; `expected.generated.ts` is the
 * committed snapshot the lessons import, written by `node scripts/lesson-examples.mjs --write`.
 * Nothing in here is ever typed by hand.
 */
export interface LessonExpected {
  profit: { sellingPrice: number; profitAmount: number }
  discount: { finalPrice: number; originalPrice: number }
  realProfit: { replacement: number; realPercent: number; verdict: ProfitStatus }
  installments: {
    monthly: number
    total: number
    reverseGainPercent: number
    reverseVerdict: ProfitStatus
  }
  /** What a +10% cost-up run must leave behind on the products the lesson does not touch. */
  products: { costUpPercent: number; newCosts: { id: number; cost: number }[] }
  /** The seeded rows a check-in challenge has to look past to see the learner's own. */
  smartRates: { seedObservationCount: number }
  everyday: { combinedProfit: number }
}

/** Figures a lesson *types in*, taken from the demo shop rather than invented. */
export interface LessonInputs {
  realProfit: { cost: string; price: string }
  everyday: { riceCost: string; riceMargin: string; oilCost: string; oilMargin: string }
}
