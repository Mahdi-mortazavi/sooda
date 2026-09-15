import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DRAFT_STORAGE_KEY,
  type DraftState,
  clearDraft,
  createDraftWriter,
  readDraft,
  writeDraft,
} from './drafts'

interface FakeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const globals = globalThis as unknown as { localStorage?: unknown; document?: unknown; window?: unknown }

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

const draft: DraftState = {
  modes: { profit: { cost: '100', sell: '125' }, discount: { price: '50' } },
  mode: 'profit',
  tab: 'calculator',
}

beforeEach(() => {
  originalLocalStorage = globals.localStorage
  store = new Map<string, string>()
  installStorage()
})

afterEach(() => {
  globals.localStorage = originalLocalStorage
  delete globals.document
  delete globals.window
  vi.useRealTimers()
})

describe('readDraft / writeDraft / clearDraft', () => {
  it('round trips a draft', () => {
    writeDraft(draft)
    expect(readDraft()).toEqual(draft)
  })

  it('round trips the optional lens', () => {
    const withLens: DraftState = { ...draft, tab: 'products', lens: { months: 12, source: 'inflation', replacement: '120' } }
    writeDraft(withLens)
    expect(readDraft()).toEqual(withLens)
  })

  it('returns null when nothing is stored', () => {
    expect(readDraft()).toBe(null)
  })

  it('clearDraft removes the entry', () => {
    writeDraft(draft)
    clearDraft()
    expect(store.has(DRAFT_STORAGE_KEY)).toBe(false)
    expect(readDraft()).toBe(null)
  })

  const malformed: Array<[string, string]> = [
    ['garbage JSON', '{not json'],
    ['a JSON array', '[]'],
    ['a JSON null', 'null'],
    ['a bare string', '"draft"'],
    ['a missing modes map', JSON.stringify({ mode: 'profit', tab: 'calculator' })],
    ['modes as an array', JSON.stringify({ modes: [], mode: 'profit', tab: 'calculator' })],
    ['modes holding non-objects', JSON.stringify({ modes: { profit: 7 }, mode: 'profit', tab: 'calculator' })],
    [
      'modes holding non-string fields',
      JSON.stringify({ modes: { profit: { cost: 100 } }, mode: 'profit', tab: 'calculator' }),
    ],
    ['a missing mode', JSON.stringify({ modes: {}, tab: 'calculator' })],
    ['an unknown tab', JSON.stringify({ modes: {}, mode: 'profit', tab: 'history' })],
    [
      'a malformed lens',
      JSON.stringify({ modes: {}, mode: 'profit', tab: 'calculator', lens: { months: 'twelve' } }),
    ],
  ]
  for (const [label, raw] of malformed) {
    it(`returns null for ${label}`, () => {
      store.set(DRAFT_STORAGE_KEY, raw)
      expect(readDraft()).toBe(null)
    })
  }

  it('returns null when localStorage throws', () => {
    installStorage({
      getItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readDraft()).toBe(null)
  })

  it('writeDraft swallows a storage quota error', () => {
    installStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => writeDraft(draft)).not.toThrow()
  })
})

describe('createDraftWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('coalesces rapid saves into a single write', () => {
    const writer = createDraftWriter(400)
    writer.save({ ...draft, mode: 'a' })
    writer.save({ ...draft, mode: 'b' })
    writer.save({ ...draft, mode: 'c' })
    expect(store.has(DRAFT_STORAGE_KEY)).toBe(false)
    vi.advanceTimersByTime(400)
    expect(readDraft()?.mode).toBe('c')
    expect(store.size).toBe(1)
    writer.cancel()
  })

  it('flush() writes immediately and leaves nothing pending', () => {
    const writer = createDraftWriter(400)
    writer.save(draft)
    writer.flush()
    expect(readDraft()).toEqual(draft)
    store.clear()
    vi.advanceTimersByTime(1000)
    expect(store.size).toBe(0)
    writer.cancel()
  })

  it('flush() with nothing pending is a no-op', () => {
    const writer = createDraftWriter(400)
    writer.flush()
    expect(store.size).toBe(0)
    writer.cancel()
  })

  it('cancel() drops a pending write', () => {
    const writer = createDraftWriter(400)
    writer.save(draft)
    writer.cancel()
    vi.advanceTimersByTime(1000)
    expect(store.size).toBe(0)
  })

  it('flushes a pending write when the document goes hidden', () => {
    const listeners = new Map<string, Set<() => void>>()
    const doc = {
      visibilityState: 'visible' as 'visible' | 'hidden',
      addEventListener(type: string, listener: () => void) {
        const set = listeners.get(type) ?? new Set<() => void>()
        set.add(listener)
        listeners.set(type, set)
      },
      removeEventListener(type: string, listener: () => void) {
        listeners.get(type)?.delete(listener)
      },
    }
    globals.document = doc

    const writer = createDraftWriter(400)
    writer.save(draft)
    doc.visibilityState = 'hidden'
    for (const listener of listeners.get('visibilitychange') ?? []) listener()
    expect(readDraft()).toEqual(draft)

    writer.cancel()
    expect(listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })
})
