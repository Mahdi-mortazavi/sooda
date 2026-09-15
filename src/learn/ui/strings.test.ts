/**
 * Every `learn.*` string the tutorial's own surfaces ask for actually exists.
 *
 * `npm run i18n:check` proves en and fa hold the same keys; it cannot prove either holds the keys
 * the code calls. `lessons` has its own test for the keys a lesson names, which leaves the centre,
 * onboarding, the challenge screen and the Settings card unguarded — and those are the surfaces
 * where a missing key is least visible, because most of the calls carry an English `defaultValue`
 * and a Persian shopkeeper would simply be shown English.
 *
 * Keys assembled from an id (the FAQ, the goal chips, the intro cards, the lesson cards, the tips)
 * are built from the very lists the components render, imported rather than restated — a second
 * copy here would let the screen show a raw key while this still passed, which is what a mutation
 * check caught the first time round.
 */

import { describe, expect, it } from 'vitest'
import enCore from '../../i18n/en.json'
import faCore from '../../i18n/fa.json'
import enSheets from '../../i18n/sheets/en.json'
import faSheets from '../../i18n/sheets/fa.json'
import { FAQ_IDS, INTRO_CARD_IDS, TIP_IDS } from './catalog'
import { GOAL_IDS, LESSON_IDS, LESSON_STATUSES } from './types'

const SOURCE = Object.entries(
  import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
)
  .map(([, text]) => text)
  .join('\n')

function referenced(): string[] {
  const keys = new Set<string>()
  for (const match of SOURCE.matchAll(/\bt\(\s*'(learn\.[A-Za-z0-9_.]+)'/g)) keys.add(match[1] as string)
  for (const id of FAQ_IDS) {
    keys.add(`learn.faq.${id}.q`)
    keys.add(`learn.faq.${id}.a`)
  }
  for (const id of INTRO_CARD_IDS) {
    keys.add(`learn.intro.${id}.title`)
    keys.add(`learn.intro.${id}.body`)
  }
  for (const id of LESSON_IDS) {
    keys.add(`learn.lessons.${id}.title`)
    keys.add(`learn.lessons.${id}.body`)
  }
  for (const id of GOAL_IDS) keys.add(`learn.goals.${id}`)
  for (const id of LESSON_STATUSES) keys.add(`learn.status.${id}`)
  for (const id of TIP_IDS) keys.add(`learn.tips.${id}`)
  return [...keys].sort()
}

function resolve(bundle: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (typeof node !== 'object' || node === null) return undefined
    return (node as Record<string, unknown>)[part]
  }, bundle)
}

function missing(core: unknown, sheets: unknown): string[] {
  return referenced().filter((key) => {
    const found = resolve(core, key) ?? resolve(sheets, key)
    return typeof found !== 'string'
  })
}

describe('the learning centre’s strings', () => {
  it('finds a real sentence behind every key it asks for, in en', () => {
    expect(missing(enCore, enSheets)).toEqual([])
  })

  it('…and in fa', () => {
    expect(missing(faCore, faSheets)).toEqual([])
  })

  it('is asking for a meaningful number of them', () => {
    // A scrape that quietly stopped matching would otherwise pass by finding nothing.
    expect(referenced().length).toBeGreaterThan(60)
  })
})
