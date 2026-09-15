import { describe, expect, it } from 'vitest'

/**
 * A component a lesson points at, which reaches real storage, must know which shop it is in.
 *
 * This is the guard that was missing. `isolation.test.ts` drives `session.repository` by hand
 * and never mounts a component, so it proved the sandbox's own surface and nothing about the app
 * rendered on top of it. `SettingsSheet` — the one lesson surface with no repository awareness at
 * all — shipped a backup challenge that called `buildBackup()`, which is bound to the real
 * database and walks real localStorage, and handed the shopkeeper their own products, price
 * history, calculations, draft and badge count as a file. Every test was green.
 *
 * So: any file that renders a `data-tour` attribute and imports a module that reaches the real
 * store must be told which shop it is in — either by calling `useRepository()`, or by being
 * handed the practice database as a prop, which is how `CalculatorView` does it. Anything else
 * must be named below with a reason. It is a cheap, static approximation of a question no render
 * test in this repo can currently ask.
 */

const SOURCES: Record<string, string> = import.meta.glob('../../components/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Modules that read or write the shopkeeper's own data. Importing one is the trigger. */
const REAL_STORE = [
  '../lib/db',
  '../lib/backup',
  '../lib/products',
  '../lib/observations',
  '../lib/basket',
  '../lib/history',
  '../lib/drafts',
  '../lib/badge',
  '../lib/rates/load',
]

/**
 * Files that render a tour target, import one of the above, and legitimately do not need the
 * repository. Every entry states why, because an unexplained exemption is how the next
 * `SettingsSheet` gets written.
 */
const ALLOWED: Record<string, string> = {}

function importsRealStore(text: string): string[] {
  return REAL_STORE.filter((m) => text.includes(`from '${m}'`) || text.includes(`import('${m}')`))
}

/** The two ways a component finds out. Both are real; neither is better than the other. */
function knowsTheShop(text: string): boolean {
  return text.includes('useRepository(') || text.includes('practiceDb')
}

describe('lesson surfaces know which shop they are in', () => {
  const tourFiles = Object.entries(SOURCES).filter(([, text]) => text.includes('data-tour'))

  it('finds the components, so an empty run cannot pass', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20)
    expect(tourFiles.length).toBeGreaterThan(5)
  })

  it('gives every real-store lesson surface a repository', () => {
    const missing = tourFiles
      .filter(([path]) => !Object.hasOwn(ALLOWED, path.replace('../../components/', '')))
      .filter(([, text]) => importsRealStore(text).length > 0)
      .filter(([, text]) => !knowsTheShop(text))
      .map(([path, text]) => `${path.replace('../../', 'src/')} imports ${importsRealStore(text).join(', ')}`)

    expect(missing).toEqual([])
  })
})
