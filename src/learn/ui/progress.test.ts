import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recommendedPath } from './catalog'
import { hasOnboarded, parseLearnQuery, tipAllowed, LEARN_STORAGE_KEY } from './entry'
import { GOAL_IDS, LESSON_IDS } from './types'

interface FakeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const globals = globalThis as unknown as { localStorage?: unknown }

let store: Map<string, string>
let originalLocalStorage: unknown

function installStorage(overrides: Partial<FakeStorage> = {}): void {
  const base: FakeStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  }
  globals.localStorage = { ...base, ...overrides }
}

/* The store keeps a module-level "is storage usable" latch and an in-memory fallback, so every
 * case gets a fresh copy of the module rather than inheriting the previous one's verdict. */
async function freshProgress() {
  vi.resetModules()
  return import('./progress')
}

beforeEach(() => {
  originalLocalStorage = globals.localStorage
  store = new Map<string, string>()
  installStorage()
})

afterEach(() => {
  globals.localStorage = originalLocalStorage
})

describe('parseLearnQuery', () => {
  it('returns null when there is no ?learn at all', () => {
    expect(parseLearnQuery('')).toBeNull()
    expect(parseLearnQuery('?tab=products')).toBeNull()
    expect(parseLearnQuery('?m=profit&a=1')).toBeNull()
  })

  it('reads a bare ?learn as "open the centre"', () => {
    expect(parseLearnQuery('?learn')).toBe('')
    expect(parseLearnQuery('?learn=')).toBe('')
    expect(parseLearnQuery('?tab=products&learn')).toBe('')
  })

  it('reads a named lesson, wherever it sits in the query', () => {
    expect(parseLearnQuery('?learn=realProfit')).toBe('realProfit')
    expect(parseLearnQuery('?m=profit&learn=smartRates')).toBe('smartRates')
    expect(parseLearnQuery('?learn=products&tab=products')).toBe('products')
  })

  it('does not match a parameter that merely starts with learn', () => {
    expect(parseLearnQuery('?learned=1')).not.toBe('1')
  })

  it('falls back to the centre rather than throwing on a malformed escape', () => {
    expect(parseLearnQuery('?learn=%E0%A4%A')).toBe('')
  })
})

describe('the progress record', () => {
  it('starts every lesson new, with tips on', async () => {
    const { readProgress } = await freshProgress()
    const progress = readProgress()
    expect(progress.onboardingDone).toBe(false)
    expect(progress.tipsEnabled).toBe(true)
    expect(Object.keys(progress.lessons).sort()).toEqual([...LESSON_IDS].sort())
    for (const id of LESSON_IDS) expect(progress.lessons[id]).toEqual({ status: 'new', step: 0 })
  })

  it('round-trips through storage under the frozen key', async () => {
    const { finishOnboarding, readProgress } = await freshProgress()
    finishOnboarding()
    expect(store.has(LEARN_STORAGE_KEY)).toBe(true)
    expect(readProgress().onboardingDone).toBe(true)
    expect(hasOnboarded()).toBe(true)
  })

  it('replaces anything unrecognisable with its default rather than handing it on', async () => {
    const { parseProgress } = await freshProgress()
    expect(parseProgress('not json')).toEqual(parseProgress(null))
    expect(parseProgress('[]').onboardingDone).toBe(false)
    const hostile = parseProgress(
      JSON.stringify({
        onboardingDone: 'yes',
        goals: ['pricing', 'nonsense', 42],
        lessons: { profit: { status: 'wizard', step: -4 }, ghost: { status: 'passed' } },
        tipsSeen: ['lens', 7],
        tipsEnabled: 0,
      }),
    )
    expect(hostile.onboardingDone).toBe(false)
    expect(hostile.goals).toEqual(['pricing'])
    expect(hostile.lessons.profit).toEqual({ status: 'new', step: 0 })
    expect(hostile.tipsSeen).toEqual(['lens'])
    // Only an explicit `false` turns tips off; garbage must not silently disable a feature.
    expect(hostile.tipsEnabled).toBe(true)
    expect(Object.keys(hostile.lessons)).not.toContain('ghost')
  })

  it('keeps goals in the canonical order however they were picked', async () => {
    const { setGoals } = await freshProgress()
    const picked = setGoals(['products', 'pricing', 'products'])
    expect(picked.goals).toEqual(GOAL_IDS.filter((g) => g === 'pricing' || g === 'products'))
  })

  it('never demotes a lesson that has already been passed', async () => {
    const { markLessonPassed, setLessonProgress } = await freshProgress()
    markLessonPassed('profit', 1000)
    const after = setLessonProgress('profit', { status: 'progress', step: 2 })
    expect(after.lessons.profit.status).toBe('passed')
    expect(after.lessons.profit.passedAt).toBe(1000)
  })

  it('counts done and passed separately, and only awards mastery on a clean sweep', async () => {
    const { markLessonPassed, mastery, readProgress, setLessonProgress } = await freshProgress()
    setLessonProgress('profit', { status: 'done', step: 0 })
    markLessonPassed('discount')
    const partial = mastery(readProgress())
    expect(partial).toMatchObject({ finished: 2, passed: 1, total: LESSON_IDS.length, master: false })
    for (const id of LESSON_IDS) markLessonPassed(id)
    expect(mastery(readProgress()).master).toBe(true)
  })

  it('resets the lessons and the tips but keeps the goals', async () => {
    const { markLessonPassed, markTipSeen, resetLessonProgress, setGoals } = await freshProgress()
    setGoals(['installments'])
    markLessonPassed('safety')
    markTipSeen('lens')
    const after = resetLessonProgress()
    expect(after.goals).toEqual(['installments'])
    expect(after.lessons.safety.status).toBe('new')
    expect(after.tipsSeen).toEqual([])
  })

  it('puts the introduction back without forgetting what was learnt', async () => {
    const { finishOnboarding, markLessonPassed, replayOnboarding } = await freshProgress()
    finishOnboarding()
    markLessonPassed('profit')
    const after = replayOnboarding()
    expect(after.onboardingDone).toBe(false)
    expect(after.lessons.profit.status).toBe('passed')
  })

  it('clears itself for "Erase all data"', async () => {
    const { clearProgress, finishOnboarding, readProgress } = await freshProgress()
    finishOnboarding()
    clearProgress()
    expect(store.has(LEARN_STORAGE_KEY)).toBe(false)
    expect(readProgress().onboardingDone).toBe(false)
  })

  it('rides in a backup and comes back out of one', async () => {
    const { exportProgress, markLessonPassed } = await freshProgress()
    markLessonPassed('everyday', 5)
    const carried = exportProgress()
    // A second device: same code, empty storage.
    store.clear()
    const fresh = await freshProgress()
    expect(fresh.readProgress().lessons.everyday.status).toBe('new')
    fresh.importProgress(carried)
    expect(fresh.readProgress().lessons.everyday).toEqual({ status: 'passed', step: 0, passedAt: 5 })
    // The same call is total: a hand-edited file cannot take the tutorial down with it.
    expect(() => fresh.importProgress('{{{')).not.toThrow()
    expect(fresh.readProgress().lessons.everyday.status).toBe('new')
  })
})

describe('with storage unavailable', () => {
  it('still runs, and still remembers for the rest of the session', async () => {
    installStorage({
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    const { markLessonPassed, readProgress } = await freshProgress()
    expect(readProgress().onboardingDone).toBe(false)
    markLessonPassed('profit')
    expect(readProgress().lessons.profit.status).toBe('passed')
  })

  it('reports no onboarding and allows every tip, rather than throwing', async () => {
    globals.localStorage = undefined
    expect(hasOnboarded()).toBe(false)
    expect(tipAllowed('lens')).toBe(true)
  })
})

describe('tips', () => {
  it('offers each one once, and none at all once they are switched off', async () => {
    const { markTipSeen, setTipsEnabled } = await freshProgress()
    expect(tipAllowed('lens')).toBe(true)
    markTipSeen('lens')
    expect(tipAllowed('lens')).toBe(false)
    expect(tipAllowed('bulk')).toBe(true)
    setTipsEnabled(false)
    expect(tipAllowed('bulk')).toBe(false)
  })
})

describe('the recommended path', () => {
  it('lists every lesson exactly once whatever was chosen', () => {
    for (const goals of [[], ['pricing'], [...GOAL_IDS]] as const) {
      const path = recommendedPath([...goals])
      expect(path).toHaveLength(LESSON_IDS.length)
      expect(new Set(path).size).toBe(LESSON_IDS.length)
    }
  })

  it('leads with the lessons that answer the goals, in the order they were given', () => {
    expect(recommendedPath(['installments'])[0]).toBe('installments')
    expect(recommendedPath(['discounts'])[0]).toBe('discount')
    expect(recommendedPath(['products', 'pricing'])[0]).toBe('products')
    expect(recommendedPath(['pricing', 'products'])[0]).toBe('profit')
  })

  it('falls back to the catalogue order when nothing was chosen', () => {
    expect(recommendedPath([])).toEqual([...LESSON_IDS])
  })
})
