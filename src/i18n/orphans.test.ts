import { describe, expect, it } from 'vitest'
import coreFa from './fa.json'
import sheetsFa from './sheets/fa.json'

/**
 * The other direction: a string that exists, is in parity, and nothing renders.
 *
 * `src/learn/lessons/i18n.test.ts` catches a key a lesson names but the bundle lacks. This
 * catches the reverse, which is the failure this release actually had. Thirteen
 * `learn.challenge.*` strings — the hint, the takeaway, the offer to replay the demo, the whole
 * no-guilt behaviour the brief asked for — sat written and in parity for three rounds while the
 * screen that was meant to render them did not exist. Every check was green the entire time,
 * because a key nobody references is indistinguishable from a key nobody needs.
 *
 * So: every `learn.*` and `whatsNew.*` string must be referenced from `src`, or be named below
 * with a reason. An unexplained orphan is either copy nobody will read or a feature nobody built,
 * and both are worth a question at the time rather than a discovery later.
 */

const NAMESPACES = ['learn.', 'whatsNew.']

/*
 * Read through the bundler rather than through `node:fs`: the app's tsconfig deliberately keeps
 * node's types out of `src`, so that an app module cannot reach for `process` and still
 * typecheck. That guard is worth more than the convenience of `readdirSync` here.
 */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Only what ships. A key referenced solely by a test is still a key nothing renders. */
function sourceFiles(): string[] {
  return Object.entries(SOURCES)
    .filter(([path]) => !/\.test\.tsx?$/.test(path))
    .map(([, text]) => text)
}

function flatten(node: unknown, prefix = '', out: string[] = []): string[] {
  if (node === null || typeof node !== 'object') {
    out.push(prefix)
    return out
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    flatten(value, prefix === '' ? key : `${prefix}.${key}`, out)
  }
  return out
}

/**
 * Two ways a key is referenced: spelled out, or built from a template.
 *
 * A template becomes a pattern — `learn.lessons.${id}.title` matches `learn.lessons.*.title` —
 * so this does not have to know the unions, and a new lesson id does not have to be taught to it.
 * `[^.]+` rather than `.+`: an interpolation fills one segment, and letting it swallow dots would
 * make one template vouch for half the bundle.
 */
function referenced(texts: string[]): { exact: Set<string>; patterns: RegExp[] } {
  const exact = new Set<string>()
  const patterns: RegExp[] = []
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  for (const text of texts) {
    for (const namespace of NAMESPACES) {
      const quoted = new RegExp(`['"](${escape(namespace)}[A-Za-z0-9_.]+)['"]`, 'g')
      for (const m of text.matchAll(quoted)) exact.add(m[1]!)

      const templated = new RegExp('`(' + escape(namespace) + '[^`]*\\$\\{[^`]*)`', 'g')
      for (const m of text.matchAll(templated)) {
        const body = m[1]!
        if (/[^A-Za-z0-9_.${}\s]/.test(body.replace(/\$\{[^}]*\}/g, ''))) continue
        const source = body
          .split(/\$\{[^}]*\}/)
          .map(escape)
          .join('[^.]+')
        patterns.push(new RegExp(`^${source}$`))
      }
    }
  }
  return { exact, patterns }
}

/** Strings that legitimately have no call site in `src`. Each one needs its reason here. */
const ALLOWED: Record<string, string> = {}

describe('no orphaned strings', () => {
  const keys = [...flatten(coreFa), ...flatten(sheetsFa)].filter((k) =>
    NAMESPACES.some((n) => k.startsWith(n)),
  )

  it('finds the bundle and the source, so an empty run cannot pass', () => {
    expect(keys.length).toBeGreaterThan(100)
    expect(sourceFiles().length).toBeGreaterThan(50)
  })

  it('references every learn.* and whatsNew.* string from shipping code', () => {
    const { exact, patterns } = referenced(sourceFiles())
    const orphans = keys.filter(
      (key) =>
        !exact.has(key) && !patterns.some((p) => p.test(key)) && !Object.hasOwn(ALLOWED, key),
    )
    expect(orphans).toEqual([])
  })
})
