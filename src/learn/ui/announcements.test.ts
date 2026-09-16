/**
 * The other half of the target contract: a step can only wait for something a component says.
 *
 * `targets.test.ts` proves the element a step points at exists. This proves the *event* it waits
 * for is sent. They are different failures with the same symptom — a tooltip on screen, the demo
 * playing, and the lesson never moving on — and the second one is the harder to see, because the
 * thing the step asked for visibly happens. Lesson 8 shipped like that: tapping «افزودن به صفحهٔ
 * خانه» opened the guide in front of the learner, and the step waited for ever, because the row
 * announced the guide's close and never its open.
 *
 * Read from the sources rather than from a rendered tree, for the same reason `targets.test.ts`
 * gives: the test environment is node, and mounting the whole app to find out whether a callback
 * calls `emitTour` is a slower and flakier way to ask.
 */

import { describe, expect, it } from 'vitest'

function concat(modules: Record<string, string>): string {
  return Object.entries(modules)
    .filter(([path]) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
    .map(([, text]) => text)
    .join('\n')
}

/** Everywhere a component announces what the user did. */
const EMITTERS = concat({
  ...import.meta.glob('../../App.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../components/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>)

/** Every lesson and Mission 1, as written. */
const LESSON_SOURCE = concat(
  import.meta.glob('../lessons/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
)

/** `{ type: 'sheet:open', sheet: 'settings' }` → `sheet:open settings`. */
function emitted(pattern: RegExp): Set<string> {
  return new Set([...EMITTERS.matchAll(pattern)].map((match) => match[1] as string))
}

const OPENS = emitted(/type:\s*'sheet:open',\s*sheet:\s*'([\w-]+)'/g)
const CLOSES = emitted(/type:\s*'sheet:close',\s*sheet:\s*'([\w-]+)'/g)
const ACTIONS = emitted(/type:\s*'action',\s*name:\s*'([\w-]+)'/g)

/** Every `opened('x')` / `closed('x')` / `tapped('x')` a lesson is judged on. */
function awaited(pattern: RegExp): string[] {
  return [...new Set([...LESSON_SOURCE.matchAll(pattern)].map((match) => match[1] as string))].sort()
}

describe('what a step waits for is what a component says', () => {
  it('every sheet a step waits to see open is announced as opening', () => {
    const wanted = awaited(/\bopened\('([\w-]+)'\)/g)
    expect(wanted.length).toBeGreaterThan(0)
    expect(wanted.filter((sheet) => !OPENS.has(sheet))).toEqual([])
  })

  it('every sheet a step waits to see closed is announced as closing', () => {
    const wanted = awaited(/\bclosed\('([\w-]+)'\)/g)
    expect(wanted.length).toBeGreaterThan(0)
    expect(wanted.filter((sheet) => !CLOSES.has(sheet))).toEqual([])
  })

  /* Not every action is a sheet, and the four a lesson asks for by name live in `actions.ts`
   * behind `REQUESTED_TOUR_ACTIONS`, so both spellings are collected. */
  it('every named action a step waits for is announced', () => {
    const direct = awaited(/\btapped\('([\w-]+)'\)/g)
    const viaConstant = [
      ...new Set(
        [...LESSON_SOURCE.matchAll(/REQUESTED_TOUR_ACTIONS\.(\w+)/g)].map((match) => {
          const camel = match[1] as string
          return camel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
        }),
      ),
    ]
    const wanted = [...new Set([...direct, ...viaConstant])].sort()
    expect(wanted.length).toBeGreaterThan(0)
    expect(wanted.filter((name) => !ACTIONS.has(name))).toEqual([])
  })
})
