import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FALLBACK_RATES,
  MAX_STORED_FX_POINTS,
  RATES_ENABLED_KEY,
  RATES_STORAGE_KEY,
  RATES_URL,
  isAutoUpdateEnabled,
  readCachedRates,
  refreshRates,
  setAutoUpdateEnabled,
} from './load'
import { validateRates } from './schema'

const globals = globalThis as unknown as { localStorage?: unknown; fetch?: unknown }
let originalFetch: PropertyDescriptor | undefined

/** A minimal in-memory Storage — vitest runs in the node environment, so there is none. */
function useFakeStorage(seed: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(seed))
  globals.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  return store
}

function useThrowingStorage(): void {
  globals.localStorage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }
}

interface FetchCall {
  url: unknown
  init: unknown
}

const calls: FetchCall[] = []

/** node 18+ has a real global fetch, so it has to be replaced rather than merely added. */
function useFetch(respond: () => Promise<unknown>): void {
  Object.defineProperty(globalThis, 'fetch', {
    value: (url: unknown, init: unknown) => {
      calls.push({ url, init })
      return respond()
    },
    configurable: true,
    writable: true,
  })
}

/** Resolves like a real Response would for a JSON body. */
function jsonResponse(body: unknown, status = 200): Promise<unknown> {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
}

/** Ascending, unique daily closes — the shape the guard expects out of the real file. */
function series(count: number): Array<[string, number]> {
  const points: Array<[string, number]> = []
  for (let i = 0; i < count; i += 1) {
    const year = 2000 + Math.floor(i / (28 * 12))
    const month = String((Math.floor(i / 28) % 12) + 1).padStart(2, '0')
    const day = String((i % 28) + 1).padStart(2, '0')
    points.push([`${year}-${month}-${day}`, 1000 + i])
  }
  return points
}

function sampleFile(pointCount = 3, overallMonthlyPercent = 2.5): Record<string, unknown> {
  return {
    schema: 1,
    updatedAt: '2026-09-01',
    cpi: {
      source: { name: 'SCI', url: 'https://example.invalid/cpi' },
      asOf: '2026-08',
      overallMonthlyPercent,
      categories: { food: 3.1, digital: 1.2 },
    },
    fx: { source: { name: 'Feed', url: 'https://example.invalid/fx' }, pair: 'USD/IRT', series: series(pointCount) },
  }
}

beforeEach(() => {
  originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  calls.length = 0
  useFakeStorage()
})

afterEach(() => {
  delete globals.localStorage
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch)
  else delete globals.fetch
})

describe('FALLBACK_RATES', () => {
  it('is a file the guard accepts, so a very first offline launch has something to read', () => {
    expect(validateRates(FALLBACK_RATES).ok).toBe(true)
    expect(FALLBACK_RATES.schema).toBe(1)
  })
})

describe('auto-update preference', () => {
  it('defaults to on when nothing is stored', () => {
    expect(isAutoUpdateEnabled()).toBe(true)
  })

  it('round trips through localStorage', () => {
    const store = useFakeStorage()
    setAutoUpdateEnabled(false)
    expect(store.get(RATES_ENABLED_KEY)).toBe('off')
    expect(isAutoUpdateEnabled()).toBe(false)
    setAutoUpdateEnabled(true)
    expect(isAutoUpdateEnabled()).toBe(true)
  })

  it('stays on, and never throws, when storage is unavailable', () => {
    useThrowingStorage()
    expect(isAutoUpdateEnabled()).toBe(true)
    expect(() => setAutoUpdateEnabled(false)).not.toThrow()
  })
})

describe('readCachedRates', () => {
  it('returns the bundled fallback when nothing is stored', () => {
    expect(readCachedRates()).toEqual({ rates: FALLBACK_RATES, origin: 'fallback' })
  })

  it('returns the stored file when there is a good one', () => {
    useFakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify(sampleFile()) })
    const state = readCachedRates()
    expect(state.origin).toBe('stored')
    expect(state.rates.cpi.overallMonthlyPercent).toBe(2.5)
  })

  it('falls back rather than trusting a stored file the guard rejects', () => {
    useFakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify({ schema: 99 }) })
    expect(readCachedRates().origin).toBe('fallback')
  })

  it('falls back on unparseable stored JSON', () => {
    useFakeStorage({ [RATES_STORAGE_KEY]: 'not json at all' })
    expect(readCachedRates().origin).toBe('fallback')
  })

  it('degrades to the fallback when localStorage throws', () => {
    useThrowingStorage()
    expect(() => readCachedRates()).not.toThrow()
    expect(readCachedRates()).toEqual({ rates: FALLBACK_RATES, origin: 'fallback' })
  })
})

describe('refreshRates', () => {
  it('stores and returns a good fetch as origin network', async () => {
    const store = useFakeStorage()
    useFetch(() => jsonResponse(sampleFile()))
    const state = await refreshRates()
    expect(state.origin).toBe('network')
    expect(state.rates.cpi.categories.food).toBe(3.1)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(RATES_URL)
    expect(JSON.parse(store.get(RATES_STORAGE_KEY) ?? 'null')).toEqual(state.rates)
  })

  it('carries nothing that could identify the device, and no other fetch option', async () => {
    /* github.io is a shared origin, so a default same-origin fetch would attach any cookie
     * another page under this account's host had set. The app promises nothing is sent. */
    const controller = new AbortController()
    useFetch(() => jsonResponse(sampleFile()))
    await refreshRates(controller.signal)
    expect(calls[0]?.init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' })
    expect(Object.keys(calls[0]?.init ?? {}).sort()).toEqual(['credentials', 'referrerPolicy', 'signal'])
    const sent = (calls[0]?.init ?? {}) as { signal?: AbortSignal }
    expect(sent.signal).toBeInstanceOf(AbortSignal)
    // The caller's signal is combined with an internal deadline, so abort must still propagate.
    controller.abort()
    expect(sent.signal?.aborted).toBe(true)
  })

  it('keeps the cached value on a 404', async () => {
    const store = useFakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify(sampleFile(3, 9.9)) })
    useFetch(() => jsonResponse('<!doctype html>', 404))
    const state = await refreshRates()
    expect(state.origin).toBe('stored')
    expect(state.rates.cpi.overallMonthlyPercent).toBe(9.9)
    expect(JSON.parse(store.get(RATES_STORAGE_KEY) ?? 'null').cpi.overallMonthlyPercent).toBe(9.9)
  })

  it('keeps the cached value when the network throws', async () => {
    useFakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify(sampleFile(3, 9.9)) })
    useFetch(() => Promise.reject(new Error('offline')))
    const state = await refreshRates()
    expect(state.origin).toBe('stored')
    expect(state.rates.cpi.overallMonthlyPercent).toBe(9.9)
  })

  it('keeps the cached value when the body fails the guard', async () => {
    const store = useFakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify(sampleFile(3, 9.9)) })
    // A plausible-looking file with one poisoned FX point: rejected whole, not in part.
    const poisoned = sampleFile()
    const fx = poisoned.fx as { series: Array<[string, number]> }
    fx.series = [['2026-09-01', -1]]
    useFetch(() => jsonResponse(poisoned))
    const state = await refreshRates()
    expect(state.origin).toBe('stored')
    expect(state.rates.cpi.overallMonthlyPercent).toBe(9.9)
    expect(JSON.parse(store.get(RATES_STORAGE_KEY) ?? 'null').cpi.overallMonthlyPercent).toBe(9.9)
  })

  it('keeps the cached value when the body is not JSON', async () => {
    useFakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify(sampleFile(3, 9.9)) })
    useFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      }),
    )
    expect((await refreshRates()).origin).toBe('stored')
  })

  it('short-circuits without calling fetch when auto-update is off', async () => {
    useFakeStorage({ [RATES_ENABLED_KEY]: 'off', [RATES_STORAGE_KEY]: JSON.stringify(sampleFile(3, 9.9)) })
    useFetch(() => jsonResponse(sampleFile()))
    const state = await refreshRates()
    expect(calls).toHaveLength(0)
    expect(state.origin).toBe('stored')
    expect(state.rates.cpi.overallMonthlyPercent).toBe(9.9)
  })

  it('still returns the fetched value when storage refuses the write', async () => {
    useThrowingStorage()
    useFetch(() => jsonResponse(sampleFile()))
    const state = await refreshRates()
    expect(state.origin).toBe('network')
    expect(state.rates.cpi.overallMonthlyPercent).toBe(2.5)
  })

  it('trims an oversized FX series to the newest points before storing', async () => {
    const store = useFakeStorage()
    useFetch(() => jsonResponse(sampleFile(MAX_STORED_FX_POINTS + 100)))
    const state = await refreshRates()

    expect(state.rates.fx.series).toHaveLength(MAX_STORED_FX_POINTS)
    // The oldest 100 points are dropped, so the first kept close is the 101st generated one.
    expect(state.rates.fx.series[0]?.[1]).toBe(1100)
    expect(state.rates.fx.series.at(-1)?.[1]).toBe(1000 + MAX_STORED_FX_POINTS + 99)

    const stored = JSON.parse(store.get(RATES_STORAGE_KEY) ?? 'null')
    expect(stored.fx.series).toHaveLength(MAX_STORED_FX_POINTS)
  })
})
