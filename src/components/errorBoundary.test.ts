/**
 * The classifier only — the boundary itself is a React component and this suite runs in the
 * node environment. What matters here is that Sooda never again tells a user to turn off
 * private browsing because of a bug that had nothing to do with their browser.
 */
import { describe, expect, it } from 'vitest'
import { isStorageError } from './ErrorBoundary'

const named = (name: string, message = 'boom') => Object.assign(new Error(message), { name })

describe('isStorageError', () => {
  it('recognises the DOM errors a blocked or full database throws', () => {
    for (const name of ['SecurityError', 'QuotaExceededError', 'InvalidStateError', 'UnknownError']) {
      expect(isStorageError(named(name))).toBe(true)
    }
  })

  it('recognises Dexie’s own failures, including a downgrade over a newer schema', () => {
    for (const name of ['DexieError', 'MissingAPIError', 'OpenFailedError', 'UpgradeError', 'VersionError']) {
      expect(isStorageError(named(name))).toBe(true)
    }
  })

  it('recognises a plain Error that names the problem in its message', () => {
    expect(isStorageError(new Error('Failed to open IndexedDB'))).toBe(true)
    expect(isStorageError(new Error('The quota has been exceeded.'))).toBe(true)
    expect(isStorageError(new Error('A transaction was aborted'))).toBe(true)
  })

  it('does NOT blame storage for an ordinary bug', () => {
    /* The regression this whole file exists for: every render error used to produce
     * "turn off private browsing", which helps nobody and blames the user's browser. */
    expect(isStorageError(new TypeError('x is not a function'))).toBe(false)
    expect(isStorageError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStorageError(named('ChunkLoadError', 'Loading chunk 7 failed'))).toBe(false)
  })

  it('is safe on things that are not Errors at all', () => {
    for (const junk of [null, undefined, 'string', 42, {}, []]) {
      expect(isStorageError(junk)).toBe(false)
    }
  })
})
