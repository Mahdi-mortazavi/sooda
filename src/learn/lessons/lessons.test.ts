/**
 * The lessons, checked as data.
 *
 * Three things are worth a test here and the rest is prose: that the eight lessons are
 * well-formed (unique ids, known targets, a demo on every step), that every `expect` says yes to
 * the thing it is waiting for and no to the near miss beside it, and that the two predicates
 * which read the practice store read it correctly. The near miss is the point: a predicate that
 * returns true for everything passes a lesson the moment the user breathes on it.
 */

import { describe, expect, it } from 'vitest'
import type { TourEvent } from '../coach/events'
import { TOUR_SHEETS } from '../coach/events'
import type { LessonStep, SandboxState } from '../coach/types'
import { buildSeed, SEED_PRODUCTS } from '../sandbox/seed'
import { LESSONS, LESSON_IDS } from './index'
import { MISSION } from './mission'
import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { PINNED_NOW } from './expected.source'
import { isTourTarget } from './targets'
import type { Lesson, LessonStepSpec, TaskChallenge } from './types'

/* ── little builders, so the table below reads as events rather than as objects ── */

const commit = (field: string, value: number): TourEvent => ({ type: 'field:commit', field, value })
const chip = (group: string, value: string): TourEvent => ({ type: 'chip:select', group, value })
const mode = (m: string): TourEvent => ({ type: 'mode:change', mode: m })
const segment = (s: string): TourEvent => ({ type: 'segment:change', segment: s })
const shown = (m: string): TourEvent => ({ type: 'result:shown', mode: m })
const did = (name: string): TourEvent => ({ type: 'action', name })
const openedSheet = (sheet: string): TourEvent => ({ type: 'sheet:open', sheet })
const closedSheet = (sheet: string): TourEvent => ({ type: 'sheet:close', sheet })

const num = (value: string): number => Number(value)

const EMPTY: SandboxState = { products: [], observations: [], profile: null, lastResult: null }

function seeded(): SandboxState {
  const seed = buildSeed(PINNED_NOW)
  return { products: seed.products, observations: seed.observations, profile: seed.profile, lastResult: null }
}

/**
 * One satisfying event and one near miss for every step, keyed `<lessonId>.<stepId>`.
 *
 * Written out rather than derived: a table generated from the predicates would agree with them by
 * construction and prove nothing. A test asserts the table covers every step, so a new step
 * cannot slip through unjudged.
 */
const CASES: Record<string, { pass: TourEvent; fail: TourEvent }> = {
  'profit.cost': { pass: commit('cost', num(LESSON_INPUTS.profit.cost)), fail: commit('cost', 150_001) },
  'profit.margin': { pass: commit('margin', num(LESSON_INPUTS.profit.margin)), fail: commit('margin', 20) },
  'profit.calculate': { pass: shown('profit'), fail: shown('sell') },
  'profit.read': { pass: did('copy-result'), fail: did('share-link') },
  'profit.toSell': { pass: segment('sell'), fail: segment('discount') },
  'profit.undercut': {
    pass: commit('price', num(LESSON_INPUTS.profit.sellPrice)),
    fail: commit('price', num(LESSON_INPUTS.profit.cost)),
  },
  'profit.loss': { pass: shown('sell'), fail: shown('profit') },

  'discount.fill': { pass: commit('off', num(LESSON_INPUTS.discount.off)), fail: commit('off', 25) },
  'discount.calculate': { pass: shown('discount'), fail: shown('rdiscount') },
  'discount.reverse': { pass: mode('rdiscount'), fail: mode('discount') },
  'discount.fillBack': {
    pass: commit('off', num(LESSON_INPUTS.discount.off)),
    fail: commit('price', num(LESSON_INPUTS.discount.off)),
  },
  'discount.calculateBack': { pass: shown('rdiscount'), fail: shown('discount') },

  'realProfit.fill': {
    pass: commit('price', num(LESSON_INPUTS.realProfit.price)),
    fail: commit('cost', num(LESSON_INPUTS.realProfit.price)),
  },
  'realProfit.nominal': { pass: shown('sell'), fail: shown('profit') },
  'realProfit.months': { pass: chip('months', LESSON_INPUTS.realProfit.months), fail: chip('months', '6') },
  'realProfit.verdict': { pass: shown('sell'), fail: shown('installment') },
  'realProfit.known': {
    pass: commit('replacement', num(LESSON_INPUTS.realProfit.knownCost)),
    fail: commit('replacement', 0),
  },
  'realProfit.again': { pass: shown('sell'), fail: shown('rdiscount') },

  'installments.toInstallments': { pass: mode('installment'), fail: mode('rinstallment') },
  'installments.cash': {
    pass: commit('cash', num(LESSON_INPUTS.installments.cash)),
    fail: commit('cash', 1_200_000),
  },
  'installments.count': { pass: chip('n', LESSON_INPUTS.installments.count), fail: chip('n', '12') },
  'installments.calculate': { pass: shown('installment'), fail: shown('rinstallment') },
  'installments.toReverse': { pass: mode('rinstallment'), fail: mode('installment') },
  'installments.neighbour': {
    pass: commit('flat', num(LESSON_INPUTS.installments.flat)),
    fail: commit('flat', 3),
  },
  'installments.judge': { pass: shown('rinstallment'), fail: shown('installment') },
  'installments.schedule': { pass: openedSheet('schedule'), fail: openedSheet('basket') },

  'products.price': { pass: commit('margin', num(LESSON_INPUTS.products.margin)), fail: commit('margin', 25) },
  'products.calculate': { pass: shown('profit'), fail: shown('sell') },
  'products.save': { pass: openedSheet('save-product'), fail: openedSheet('product') },
  'products.name': { pass: did('save-product'), fail: did('apply-new-cost') },
  'products.health': { pass: openedSheet('product'), fail: openedSheet('product-picker') },
  'products.newCost': { pass: did('apply-new-cost'), fail: did('record-cost') },

  'smartRates.profile': { pass: closedSheet('store-profile'), fail: openedSheet('store-profile') },
  'smartRates.why': { pass: did('rate-why'), fail: did('rate-manual') },
  'smartRates.manual': { pass: did('rate-manual'), fail: did('rate-auto') },
  'smartRates.auto': { pass: did('rate-auto'), fail: did('rate-manual') },
  'smartRates.checkin': { pass: openedSheet('check-in'), fail: openedSheet('outlier') },

  'everyday.rice': {
    pass: commit('margin', num(LESSON_INPUTS.everyday.riceMargin)),
    fail: commit('margin', num(LESSON_INPUTS.everyday.oilMargin)),
  },
  'everyday.calcRice': { pass: shown('profit'), fail: shown('sell') },
  'everyday.basketRice': { pass: did('add-to-basket'), fail: did('share-link') },
  'everyday.oil': {
    pass: commit('margin', num(LESSON_INPUTS.everyday.oilMargin)),
    fail: commit('margin', num(LESSON_INPUTS.everyday.riceMargin)),
  },
  'everyday.calcOil': { pass: shown('profit'), fail: shown('discount') },
  'everyday.basketOil': { pass: did('add-to-basket'), fail: did('copy-result') },
  'everyday.share': { pass: did('share-link'), fail: did('add-to-basket') },
  'everyday.totals': { pass: openedSheet('basket'), fail: openedSheet('history') },
  'everyday.csv': { pass: did('export-csv'), fail: did('clear-history') },

  'safety.settings': { pass: openedSheet('settings'), fail: openedSheet('install-guide') },
  'safety.install': { pass: openedSheet('install-guide'), fail: openedSheet('settings') },
  'safety.updates': { pass: did('toggle-auto-rates'), fail: did('backup') },
}

/** The same table for Mission 1, which is not in `LESSONS` and so is not covered above. */
const MISSION_CASES: Record<string, { pass: TourEvent; fail: TourEvent }> = {
  cost: { pass: commit('cost', num(LESSON_INPUTS.mission.cost)), fail: commit('cost', 10_000) },
  margin: { pass: commit('margin', num(LESSON_INPUTS.mission.margin)), fail: commit('margin', 25) },
  calculate: { pass: shown('profit'), fail: shown('sell') },
  months: { pass: chip('months', LESSON_INPUTS.mission.months), fail: chip('months', '1') },
  again: { pass: shown('profit'), fail: shown('rdiscount') },
}

function everyStep(): { lesson: Lesson; step: LessonStep; key: string }[] {
  return LESSONS.flatMap((lesson) =>
    lesson.steps.map((step) => ({ lesson, step, key: `${lesson.id}.${step.id}` })),
  )
}

function tasks(): { lesson: Lesson; challenge: TaskChallenge }[] {
  return LESSONS.flatMap((lesson) =>
    lesson.challenges.filter((c): c is TaskChallenge => c.kind === 'task').map((challenge) => ({ lesson, challenge })),
  )
}

describe('the eight lessons are well formed', () => {
  it('has eight of them, with unique ids', () => {
    expect(LESSONS).toHaveLength(8)
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(8)
  })

  it('gives every step and every challenge an id unique within its lesson', () => {
    for (const lesson of LESSONS) {
      const steps = lesson.steps.map((s) => s.id)
      expect(new Set(steps).size, `${lesson.id} step ids`).toBe(steps.length)
      const challenges = lesson.challenges.map((c) => c.id)
      expect(new Set(challenges).size, `${lesson.id} challenge ids`).toBe(challenges.length)
      expect(lesson.challenges.length, `${lesson.id} has a challenge`).toBeGreaterThan(0)
    }
  })

  it('keys every string as learn.<lessonId>.<stepId>', () => {
    for (const lesson of LESSONS) {
      // The card's own keys: the Learning Centre wrote them first and copy already has them.
      expect(lesson.titleKey).toBe(`learn.lessons.${lesson.id}.title`)
      expect(lesson.summaryKey).toBe(`learn.lessons.${lesson.id}.body`)
      for (const step of lesson.steps) expect(step.textKey).toBe(`learn.${lesson.id}.${step.id}`)
      for (const challenge of lesson.challenges) {
        /* A choice challenge's prompt sits one level deeper, at `….<id>.prompt`. It has to: the
         * options live under `….<id>.<optionId>`, and a nested JSON bundle cannot have the same
         * path be both a string and an object — i18next resolves `t('…<id>')` to the object
         * warning and the options to their own keys, so one of the two always breaks. This test
         * only ever compared key strings, which is why it passed while three prompts were dead. */
        const promptKey = challenge.kind === 'choice'
          ? `learn.${lesson.id}.challenge.${challenge.id}.prompt`
          : `learn.${lesson.id}.challenge.${challenge.id}`
        expect(challenge.promptKey).toBe(promptKey)
        if (challenge.kind !== 'choice') continue
        for (const option of challenge.options) {
          expect(option.labelKey).toBe(`learn.${lesson.id}.challenge.${challenge.id}.${option.id}`)
        }
      }
    }
  })

  it('points only at targets ui has been asked for', () => {
    const targets: string[] = []
    for (const { step } of everyStep()) {
      targets.push(step.target)
      for (const action of step.demo?.actions ?? []) targets.push(action.target)
    }
    for (const { challenge } of tasks()) {
      targets.push(challenge.target)
      for (const action of challenge.demo.actions) targets.push(action.target)
    }
    for (const target of targets) expect(isTourTarget(target), target).toBe(true)
  })

  it('waits only for sheets the coach knows about', () => {
    /* A step that waits for `sheet:open` on a name nobody emits is a lesson that stops dead, and
     * the name is a string in the event — so the list is the only thing that can catch a typo. */
    const sheets: string[] = []
    for (const { pass } of Object.values(CASES)) {
      if (pass.type === 'sheet:open' || pass.type === 'sheet:close') sheets.push(pass.sheet)
    }
    for (const sheet of sheets) expect(TOUR_SHEETS as readonly string[]).toContain(sheet)
  })

  it('can always be finished by «نشانم بده»', () => {
    for (const { step, key } of everyStep()) {
      expect(step.demo?.actions.length ?? 0, key).toBeGreaterThan(0)
      for (const action of step.demo?.actions ?? []) {
        if (action.type === 'type') expect(action.value, key).not.toBe('')
      }
    }
    for (const { lesson, challenge } of tasks()) {
      expect(challenge.demo.actions.length, `${lesson.id}.${challenge.id}`).toBeGreaterThan(0)
    }
  })

  it('fits in the plan’s ninety seconds', () => {
    for (const lesson of LESSONS) {
      expect(lesson.estimateSeconds, lesson.id).toBeGreaterThanOrEqual(30)
      expect(lesson.estimateSeconds, lesson.id).toBeLessThanOrEqual(90)
    }
  })

  it('offers exactly one right answer per choice, and a real tolerance per figure', () => {
    for (const lesson of LESSONS) {
      for (const challenge of lesson.challenges) {
        if (challenge.kind === 'choice') {
          expect(challenge.options.length, `${lesson.id}.${challenge.id}`).toBeGreaterThan(1)
          expect(challenge.options.filter((o) => o.correct)).toHaveLength(1)
        }
        if (challenge.kind === 'number') {
          expect(challenge.tolerance).toBeGreaterThan(0)
          // Slack for a rounding step, never enough to accept a different answer.
          expect(challenge.tolerance).toBeLessThan(Math.abs(challenge.answer) / 10)
        }
      }
    }
  })
})

describe('every step advances on the right event and on nothing else', () => {
  it('has a case for every step', () => {
    const keys = everyStep().map(({ key }) => key)
    expect(keys.sort()).toEqual(Object.keys(CASES).sort())
  })

  for (const { step, key } of everyStep()) {
    it(`${key} advances on what it asks for`, () => {
      const testCase = CASES[key]
      if (testCase === undefined) throw new Error(`no case for ${key}`)
      expect(step.expect(testCase.pass, EMPTY), 'the satisfying event').toBe(true)
      expect(step.expect(testCase.fail, EMPTY), 'the near miss').toBe(false)
      // And nothing at all happening is never enough.
      expect(step.expect({ type: 'action', name: 'nothing-like-it' }, EMPTY)).toBe(false)
    })
  }
})

describe('the challenges that read the practice shop', () => {
  const challengeOf = (lessonId: string, id: string): TaskChallenge => {
    const found = tasks().find((t) => t.lesson.id === lessonId && t.challenge.id === id)
    if (found === undefined) throw new Error(`no task ${lessonId}.${id}`)
    return found.challenge
  }

  it('products — passes only once every untouched row carries the new cost', () => {
    const bulk = challengeOf('products', 'bulk')
    const before = seeded()
    expect(bulk.done(did('bulk-apply'), before)).toBe(false)

    const after: SandboxState = {
      ...before,
      products: before.products.map((product) => {
        const row = LESSON_EXPECTED.products.newCosts.find((r) => r.id === product.id)
        return row === undefined ? product : { ...product, cost: row.cost }
      }),
    }
    expect(bulk.done(did('bulk-apply'), after)).toBe(true)

    // One row missed — a half-applied run is not a finished challenge.
    const partial: SandboxState = {
      ...after,
      products: after.products.map((p) => (p.id === SEED_PRODUCTS.battery ? { ...p, cost: 1 } : p)),
    }
    expect(bulk.done(did('bulk-apply'), partial)).toBe(false)
  })

  it('smartRates — counts the learner’s own readings, not the shop’s', () => {
    const record = challengeOf('smartRates', 'record')
    const before = seeded()
    /* The demo shop ships with a `checkin` reading of its own; if that counted, the challenge
     * would be passed before the learner had done anything. */
    expect(before.observations.some((o) => o.source === 'checkin')).toBe(true)
    expect(record.done(did('record-cost'), before)).toBe(false)

    const seedRows = LESSON_EXPECTED.smartRates.seedObservationCount
    const one: SandboxState = {
      ...before,
      observations: [
        ...before.observations,
        { id: seedRows + 1, productId: SEED_PRODUCTS.shampoo, cost: 250_000, observedAt: PINNED_NOW, source: 'checkin' },
      ],
    }
    expect(record.done(did('record-cost'), one), 'one product is not two').toBe(false)

    const twice: SandboxState = {
      ...one,
      observations: [
        ...one.observations,
        { id: seedRows + 2, productId: SEED_PRODUCTS.shampoo, cost: 251_000, observedAt: PINNED_NOW, source: 'checkin' },
      ],
    }
    expect(record.done(did('record-cost'), twice), 'twice on one product is not two products').toBe(false)

    const two: SandboxState = {
      ...one,
      observations: [
        ...one.observations,
        { id: seedRows + 3, productId: SEED_PRODUCTS.notebook, cost: 78_000, observedAt: PINNED_NOW, source: 'checkin' },
      ],
    }
    expect(record.done(did('record-cost'), two)).toBe(true)
  })

  it('safety — the backup has to actually be taken', () => {
    const backup = challengeOf('safety', 'backup')
    expect(backup.done(did('backup'), EMPTY)).toBe(true)
    expect(backup.done(did('restore'), EMPTY)).toBe(false)
  })
})

describe('Mission 1', () => {
  it('is not a lesson', () => {
    /* A ninth id in that union would let onboarding write a progress row for something the
     * Learning Centre never lists — and it would type-check. */
    expect((LESSON_IDS as string[]).includes(MISSION.id)).toBe(false)
    expect(MISSION.challenges).toHaveLength(0)
  })

  it('fits in the plan’s thirty seconds and ends on the real-profit verdict', () => {
    expect(MISSION.estimateSeconds).toBeLessThanOrEqual(30)
    expect(MISSION.showsRate).toBe(true)
    const last = MISSION.steps[MISSION.steps.length - 1]
    // The lens is set two steps earlier; the last thing asked for is the calculation that shows it.
    expect(MISSION.steps.map((s) => s.id)).toContain('months')
    expect(last?.id).toBe('again')
  })

  it('names a story card, its own keys, and known targets', () => {
    expect(MISSION.storyKey).toBe('learn.mission.story')
    for (const step of MISSION.steps) {
      expect(step.textKey).toBe(`learn.mission.${step.id}`)
      expect(isTourTarget(step.target), step.target).toBe(true)
      expect(step.demo.actions.length, step.id).toBeGreaterThan(0)
      for (const action of step.demo.actions) expect(isTourTarget(action.target), action.target).toBe(true)
    }
  })

  it('offers the suggestion chip as the first step’s way in', () => {
    const first = MISSION.steps[0]
    expect(first?.id).toBe('cost')
    expect(first?.demo.actions[0]?.target).toBe('chip-suggest-cost')
    // The chip fills the field with the very figure the mission's answer was computed from.
    expect(MISSION.suggestion.field).toBe('cost')
    expect(MISSION.suggestion.value).toBe(LESSON_INPUTS.mission.cost)
    expect(MISSION.suggestion.labelKey).toBe('learn.mission.suggestCost')
    expect(first?.expect(commit('cost', num(MISSION.suggestion.value)), EMPTY)).toBe(true)
  })

  it('has a case for every step, and every step judges it', () => {
    expect(MISSION.steps.map((s) => s.id).sort()).toEqual(Object.keys(MISSION_CASES).sort())
    for (const step of MISSION.steps) {
      const testCase = MISSION_CASES[step.id]
      if (testCase === undefined) throw new Error(`no case for mission.${step.id}`)
      expect(step.expect(testCase.pass, EMPTY), `${step.id} satisfying`).toBe(true)
      expect(step.expect(testCase.fail, EMPTY), `${step.id} near miss`).toBe(false)
    }
  })

  it('takes the suggestion chip’s figure however the chip announces it', () => {
    const first: LessonStepSpec | undefined = MISSION.steps[0]
    const typed: TourEvent = { type: 'field:commit', field: 'cost', value: 100_000 }
    const chipped: TourEvent = { type: 'field:change', field: 'cost', value: '100000' }
    expect(first?.expect(typed, EMPTY)).toBe(true)
    expect(first?.expect(chipped, EMPTY)).toBe(true)
    expect(first?.expect({ type: 'field:change', field: 'cost', value: '10' }, EMPTY)).toBe(false)
  })
})

describe('the lessons satisfy the coach’s own contract', () => {
  it('hands the coach plain LessonSteps', () => {
    for (const lesson of LESSONS) {
      const steps: LessonStep[] = lesson.steps
      expect(steps.length).toBeGreaterThan(0)
    }
  })

  it('never hides a challenge behind a missing target', () => {
    for (const { lesson, challenge } of tasks()) {
      expect(typeof challenge.target, `${lesson.id}.${challenge.id}`).toBe('string')
    }
  })
})
