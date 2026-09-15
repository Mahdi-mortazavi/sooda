/**
 * What a lesson is.
 *
 * The step itself is the coach's `LessonStep`; everything here either narrows it (so a target
 * that `ui` has not been asked for cannot be typed by accident) or wraps it (title, challenge,
 * how long the thing takes). Type-only apart from the unions, so importing it costs nothing.
 */

import type { ProfitStatus } from '../../lib/inflation'
import type { TourEvent } from '../coach/events'
import type { LessonStep, SandboxState, TourCtx } from '../coach/types'
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
  /** Puts the shop where the task can be done — the same hook a step has, for the same reason. */
  before?: (ctx: TourCtx) => void | Promise<void>
}

export type Challenge = NumberChallenge | ChoiceChallenge | TaskChallenge

/**
 * Mission 1 — the sixty-second-or-less thing onboarding ends on, and the sixty seconds
 * «آموزش ۶۰ ثانیه‌ای را ببینید» promises.
 *
 * Not a ninth `LessonId` on purpose: it is not a Learning Centre card, it has no progress row of
 * its own, and giving it an id from that union would let it be written into the lessons map by a
 * call that type-checks. It is the same shape a lesson runs as — steps the coach drives — with a
 * story card in front and no quiz behind, because onboarding ends on a badge, not on a question.
 */
export interface Mission {
  id: 'mission'
  /** The card shown before step 1: «آقا رضا شالی را ۱۰۰٬۰۰۰ تومان خریده…». */
  storyKey: string
  /**
   * The suggestion chip the first step offers, for `RepositoryContext.suggestion`.
   *
   * The figure lives here rather than in the host because it is the same 100,000 the mission's
   * answer was computed from: typed in two places, the two would eventually disagree and the
   * chip would fill the field with a number the step does not accept.
   */
  suggestion: { field: string; value: string; labelKey: string }
  estimateSeconds: number
  showsRate: boolean
  /**
   * The step from which the pinned-rate note appears, rather than from step 1.
   *
   * A lesson can afford to state its assumption up front. The mission cannot: it is a minute
   * long and it is the first thing anyone reads, and «در این تمرین فرض می‌کنیم قیمت‌ها
   * ماهی ۳٪ گران می‌شوند.» on screen from step 1 spends a new user's attention on a caveat about
   * something three steps away. The note still has to appear — it is the honesty of every figure
   * that follows — so it appears when the lens engages and the learner has a reason to want it.
   */
  rateNoteFromStep?: string
  steps: LessonStepSpec[]
  /** Always empty. Present so the host can hand a mission to the same runner as a lesson. */
  challenges: Challenge[]
}

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
  discount: {
    finalPrice: number
    /**
     * The challenge's own premise, which is NOT the discount the lesson runs.
     *
     * The lesson works 30% off 500,000 forwards and then backwards, and says both figures out
     * loud, so asking for 500,000 afterwards was asking the learner to repeat a number rather
     * than to work one out. The challenge is given a sale the lesson never ran.
     */
    challenge: { finalPrice: number; offPercent: number; originalPrice: number }
  }
  realProfit: {
    replacement: number
    realPercent: number
    verdict: ProfitStatus
    /**
     * The same oil at a horizon the lesson does not run, which is what the challenge asks about.
     *
     * The lesson's own runs are both three months out and both on screen when the question is
     * asked; a verdict copied off the card teaches nothing. At a shorter horizon the answer
     * flips, so the learner has to have understood that the horizon is what decides it.
     */
    challenge: { months: number; replacement: number; realPercent: number; verdict: ProfitStatus }
  }
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
  /** Mission 1: the answer, and what three months of the pinned rate leaves of it. */
  mission: {
    sellingPrice: number
    profitAmount: number
    replacement: number
    realPercent: number
    verdict: ProfitStatus
    /** What the card suggests charging instead, once the lens is on. */
    suggested: number
  }
}

/**
 * Every value a lesson types in, as a string, in one place.
 *
 * A lesson file holds no figures at all: the ones that come out of the engine are derived, and
 * the ones the story supplies (what «آقا رضا» paid, what the supplier now quotes) are declared
 * once beside them, so a demo script and the `expect` that judges it can never drift apart.
 */
export interface LessonInputs {
  profit: { cost: string; margin: string; sellPrice: string }
  discount: { original: string; off: string; final: string }
  realProfit: { cost: string; price: string; months: string; knownCost: string }
  installments: { cash: string; count: string; flat: string }
  /** `name` is the only non-number here: what «نشانم بده» types into the save sheet. */
  products: { cost: string; margin: string; name: string; newCost: string; bulkPercent: string }
  /** `checkInCost` is the price «نشانم بده» records for the first product the check-in offers. */
  smartRates: { manualRate: string; checkInCost: string }
  everyday: { riceCost: string; riceMargin: string; oilCost: string; oilMargin: string }
  mission: { cost: string; margin: string; months: string }
}
