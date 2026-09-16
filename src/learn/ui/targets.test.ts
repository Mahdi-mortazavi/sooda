/**
 * `ui`'s half of the target contract: every name in `src/learn/lessons/targets.ts` is actually
 * produced somewhere in the tree.
 *
 * This reads the sources rather than a rendered tree, because the test environment is node and
 * mounting the whole app to find an attribute would be a slower, flakier way of asking the same
 * question. What it can prove is exactly what goes wrong in practice: a target that was never
 * added, an attribute deleted during a refactor, or a generated name whose ingredient — a field
 * key, a chip value — was renamed underneath it. What it cannot prove is that the element is on
 * screen at the moment a step points at it; the browser smoke run is what covers that.
 */

import { describe, expect, it } from 'vitest'
import { TOUR_TARGET_NAMES } from '../lessons/targets'

/* Read through Vite rather than `node:fs`: the tsconfig deliberately limits `types` to the Vite
 * clients, so the test uses the same import machinery the app does. */
function concat(modules: Record<string, string>): string {
  return Object.entries(modules)
    .filter(([path]) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
    .map(([, text]) => text)
    .join('\n')
}

/** Everywhere an attribute may live: `ui` owns these, and nothing else carries a `data-tour`. */
const SOURCE = concat({
  ...import.meta.glob('../../App.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../components/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>)

/** Where a generated name's ingredient — a field key — is actually declared. */
const MODES = concat(
  import.meta.glob('../../lib/modes/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >,
)

/**
 * The three generated families, each with the template that produces it and where its ingredient
 * is declared. Spelled out so that deleting a template fails here rather than at the first step
 * of a lesson that points at one of its names.
 */
const GENERATORS = [
  { test: /^field-(.+)$/, template: '`field-${field.key}`', ingredient: (key: string) => `key: '${key}'` },
  {
    test: /^chip-(.+)-([^-]+)$/,
    template: '`chip-${tourKey}-${option.value}`',
    ingredient: () => null,
  },
  { test: /^seg-(.+)$/, template: '${tourPrefix}${opt.value}', ingredient: () => null },
] as const

function literal(name: string): boolean {
  return SOURCE.includes(`"${name}"`) || SOURCE.includes(`'${name}'`) || SOURCE.includes(`\`${name}\``)
}

function generated(name: string): boolean {
  for (const generator of GENERATORS) {
    const match = generator.test.exec(name)
    if (match === null) continue
    if (!SOURCE.includes(generator.template)) return false
    const ingredient = generator.ingredient(match[1] ?? '')
    return ingredient === null || MODES.includes(ingredient) || literal(match[1] ?? '')
  }
  return false
}

describe('data-tour coverage', () => {
  it('has a name in the tree for every target a lesson may point at', () => {
    const missing = TOUR_TARGET_NAMES.filter((name) => !literal(name) && !generated(name))
    expect(missing).toEqual([])
  })

  it('carries no data-tour name that is not on the list', () => {
    /* The other direction, which is what stops the tree drifting into private names: a lesson may
     * only point at a listed target, so an attribute outside the list is either a typo or a name
     * `lessons` was never told about. */
    const rendered = new Set<string>()
    for (const match of SOURCE.matchAll(/data-tour="([a-z0-9-]+)"/g)) rendered.add(match[1] as string)
    const known = new Set<string>(TOUR_TARGET_NAMES)
    expect([...rendered].filter((name) => !known.has(name))).toEqual([])
  })

  it('keeps the generated families reachable', () => {
    for (const generator of GENERATORS) expect(SOURCE).toContain(generator.template)
  })
})
