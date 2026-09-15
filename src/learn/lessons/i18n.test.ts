import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import coreEn from '../../i18n/en.json'
import coreFa from '../../i18n/fa.json'
import sheetsEn from '../../i18n/sheets/en.json'
import sheetsFa from '../../i18n/sheets/fa.json'
import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { LESSONS } from './index'
import { MISSION } from './mission'
import { TUTORIAL_RATE_NOTE_KEY } from './rate'

/**
 * Every key a lesson names must resolve, in both languages, against the real bundles.
 *
 * `lessons.test.ts` checks the *shape* of these keys — that they read
 * `learn.<lessonId>.<stepId>` — and that is worth checking, but it compares strings to strings
 * and never asks i18next for one. Three choice-challenge prompts shipped dead behind that green
 * test: their key was `learn.<l>.challenge.<id>` while the options were
 * `learn.<l>.challenge.<id>.<optionId>`, which asks a nested bundle to make one path both a
 * string and an object. i18next answers the parent with "returned an object instead of string".
 * Nothing in the suite noticed, because nothing in the suite resolved a key.
 *
 * So: this file resolves all of them. A missing key, an empty string, or an object in a string's
 * place fails here rather than in front of a shopkeeper.
 */

const LANGUAGES = ['fa', 'en'] as const

beforeAll(async () => {
  await i18next.init({
    lng: 'fa',
    resources: {
      fa: { translation: { ...coreFa, ...sheetsFa } },
      en: { translation: { ...coreEn, ...sheetsEn } },
    },
    // Falling back would let a missing Persian string pass by rendering the English one —
    // the exact failure this file exists to catch.
    fallbackLng: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  })
})

/** Every key the eight lessons, Mission 1 and the pinned-rate note name, labelled for the failure. */
function everyKey(): { key: string; where: string }[] {
  const out: { key: string; where: string }[] = [
    { key: TUTORIAL_RATE_NOTE_KEY, where: 'the pinned-rate note' },
    { key: MISSION.storyKey, where: 'mission story card' },
    { key: MISSION.suggestion.labelKey, where: 'mission suggestion chip' },
  ]
  for (const step of MISSION.steps) out.push({ key: step.textKey, where: `mission.${step.id}` })
  for (const lesson of LESSONS) {
    out.push({ key: lesson.titleKey, where: `${lesson.id} title` })
    out.push({ key: lesson.summaryKey, where: `${lesson.id} summary` })
    for (const step of lesson.steps) out.push({ key: step.textKey, where: `${lesson.id}.${step.id}` })
    for (const challenge of lesson.challenges) {
      out.push({ key: challenge.promptKey, where: `${lesson.id} challenge ${challenge.id}` })
      if (challenge.kind !== 'choice') continue
      for (const option of challenge.options) {
        out.push({ key: option.labelKey, where: `${lesson.id} challenge ${challenge.id} option ${option.id}` })
      }
    }
  }
  return out
}

describe('lesson strings resolve', () => {
  it('names at least one key per lesson, so an empty list cannot pass this file', () => {
    expect(everyKey().length).toBeGreaterThanOrEqual(LESSONS.length * 3)
  })

  for (const lng of LANGUAGES) {
    it(`resolves every lesson key in ${lng}`, () => {
      const broken: string[] = []
      for (const { key, where } of everyKey()) {
        const value = i18next.getFixedT(lng)(key)
        if (typeof value !== 'string' || value.length === 0) broken.push(`${where}: ${key} → not a string`)
        // i18next answers a missing key with the key itself, and an object with a warning sentence.
        else if (value === key) broken.push(`${where}: ${key} → missing`)
        else if (value.includes('returned an object instead of string')) {
          broken.push(`${where}: ${key} → an object lives at this path, not a string`)
        }
      }
      expect(broken).toEqual([])
    })
  }

  /**
   * The last member of the family. `learn.rateNote` was a key nothing resolved; the three choice
   * prompts were keys nothing resolved; this would be a key that resolves to a lie. The
   * celebration screen is the first thing a new user ever completes and it states the payoff in
   * words — «۲۰٪ روی کاغذ، بعد از سه ماه کمتر از ۱۰٪» — rather than interpolating the figure,
   * because an unpassed `{{real}}` on that screen would be far worse than a rounded number. The
   * cost of writing it in words is that the engine can drift out from under the sentence, so the
   * sentence gets a test.
   */
  it('keeps learn.celebrateBody true: the mission really does fall from 20% to under 10%', () => {
    expect(LESSON_EXPECTED.mission.realPercent).toBeLessThan(10)
    // Still a profit, not a loss — «کمتر از ۱۰٪» would be a strange way to say "you lost money".
    expect(LESSON_EXPECTED.mission.realPercent).toBeGreaterThan(0)
    expect(Number(LESSON_INPUTS.mission.margin)).toBe(20)
  })

  it('gives a choice challenge a prompt and its options distinct, resolvable paths', () => {
    const t = i18next.getFixedT('fa')
    for (const lesson of LESSONS) {
      for (const challenge of lesson.challenges) {
        if (challenge.kind !== 'choice') continue
        const prompt = t(challenge.promptKey)
        for (const option of challenge.options) {
          expect(option.labelKey).not.toBe(challenge.promptKey)
          expect(t(option.labelKey)).not.toBe(prompt)
        }
      }
    }
  })
})
