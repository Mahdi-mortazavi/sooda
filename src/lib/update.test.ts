import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAST_SEEN_VERSION_KEY,
  PRE_V13_VERSION,
  UPDATE_INTERVAL_MS,
  VISIBILITY_THROTTLE_MS,
  readLastSeenVersion,
  resolveLastSeenVersion,
  shouldShowWhatsNew,
  startUpdateChecks,
  storeLastSeenVersion,
} from './update'

interface FakeRegistration {
  update: () => Promise<void>
  calls: number
}

function fakeRegistration(behaviour: 'resolve' | 'reject' | 'throw' = 'resolve'): FakeRegistration {
  const reg: FakeRegistration = {
    calls: 0,
    update() {
      reg.calls += 1
      if (behaviour === 'throw') throw new Error('update failed synchronously')
      return behaviour === 'reject' ? Promise.reject(new Error('offline')) : Promise.resolve()
    },
  }
  return reg
}

/** startUpdateChecks only ever reads registration.update(), so a hand-rolled stub is enough. */
function asRegistration(fake: FakeRegistration): ServiceWorkerRegistration {
  return fake as unknown as ServiceWorkerRegistration
}

interface FakeDocument {
  visibilityState: 'visible' | 'hidden'
  listeners: Map<string, Set<() => void>>
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
  dispatch: (type: string) => void
}

function fakeDocument(): FakeDocument {
  const listeners = new Map<string, Set<() => void>>()
  return {
    visibilityState: 'visible',
    listeners,
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set<() => void>()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) listener()
    },
  }
}

const globals = globalThis as unknown as { document?: unknown; navigator?: unknown; localStorage?: unknown }
let doc: FakeDocument
let originalNavigator: PropertyDescriptor | undefined

/** navigator is a getter-only global in the node test environment, so it has to be redefined. */
function setOnline(online: boolean): void {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: online }, configurable: true, writable: true })
}

beforeEach(() => {
  originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  doc = fakeDocument()
  globals.document = doc
  setOnline(true)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete globals.document
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else delete globals.navigator
})

describe('startUpdateChecks — interval', () => {
  it('calls update() on every interval tick', () => {
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg))
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(reg.calls).toBe(1)
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(reg.calls).toBe(2)
    stop()
  })

  it('skips the tick entirely while offline', () => {
    setOnline(false)
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg))
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS * 3)
    expect(reg.calls).toBe(0)
    stop()
  })

  it('stops the interval after teardown', () => {
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg))
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    stop()
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS * 5)
    expect(reg.calls).toBe(1)
  })
})

describe('startUpdateChecks — visibility', () => {
  it('checks when the page becomes visible, then throttles', () => {
    let clock = 1_000_000
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg), { now: () => clock })

    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(1)

    // one minute later — inside the throttle window
    clock += 60_000
    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(1)

    // eleven minutes after the first check — past the window
    clock += 10 * 60_000
    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(2)
    stop()
  })

  it('ignores visibilitychange while hidden', () => {
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg))
    doc.visibilityState = 'hidden'
    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(0)
    stop()
  })

  it('suppresses a focus check that lands right after an interval check', () => {
    let clock = 1_000_000
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg), { now: () => clock })
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS)
    expect(reg.calls).toBe(1)
    clock += VISIBILITY_THROTTLE_MS - 1
    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(1)
    stop()
  })

  it('does nothing on focus while offline', () => {
    setOnline(false)
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg))
    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(0)
    stop()
  })

  it('removes the visibilitychange listener on teardown', () => {
    const reg = fakeRegistration()
    const stop = startUpdateChecks(asRegistration(reg))
    stop()
    doc.dispatch('visibilitychange')
    expect(reg.calls).toBe(0)
    expect(doc.listeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })
})

describe('startUpdateChecks — failure handling', () => {
  it('swallows a rejected update()', async () => {
    const reg = fakeRegistration('reject')
    const stop = startUpdateChecks(asRegistration(reg))
    expect(() => doc.dispatch('visibilitychange')).not.toThrow()
    await Promise.resolve()
    expect(reg.calls).toBe(1)
    stop()
  })

  it('swallows a synchronous throw from update()', () => {
    const reg = fakeRegistration('throw')
    const stop = startUpdateChecks(asRegistration(reg))
    expect(() => doc.dispatch('visibilitychange')).not.toThrow()
    expect(reg.calls).toBe(1)
    stop()
  })
})

describe('shouldShowWhatsNew', () => {
  it('stays hidden on a first install', () => {
    expect(shouldShowWhatsNew('1.3.0', null)).toBe(false)
  })
  it('shows after an upgrade', () => {
    expect(shouldShowWhatsNew('1.3.0', '1.2.0')).toBe(true)
  })
  it('stays hidden when the versions match', () => {
    expect(shouldShowWhatsNew('1.3.0', '1.3.0')).toBe(false)
  })
  it('stays hidden when the stored version is newer than the running one', () => {
    expect(shouldShowWhatsNew('1.3.0', '1.4.0')).toBe(false)
    expect(shouldShowWhatsNew('1.3.0', '2.0.0')).toBe(false)
  })
  it('handles uneven and prerelease version shapes', () => {
    expect(shouldShowWhatsNew('1.3', '1.2.9')).toBe(true)
    expect(shouldShowWhatsNew('1.3.0-rc.1', '1.3.0')).toBe(false)
    expect(shouldShowWhatsNew('1.3.0', '')).toBe(false)
  })
})

describe('last seen version storage', () => {
  it('round trips through localStorage', () => {
    const store = new Map<string, string>()
    globals.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    }
    expect(readLastSeenVersion()).toBe(null)
    storeLastSeenVersion('1.3.0')
    expect(store.get(LAST_SEEN_VERSION_KEY)).toBe('1.3.0')
    expect(readLastSeenVersion()).toBe('1.3.0')
    delete globals.localStorage
  })

  it('never throws when storage is unavailable', () => {
    globals.localStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readLastSeenVersion()).toBe(null)
    expect(() => storeLastSeenVersion('1.3.0')).not.toThrow()
    delete globals.localStorage
  })
})

describe('resolveLastSeenVersion', () => {
  /** A minimal in-memory Storage, installed only for these cases. */
  function useFakeStorage(seed: Record<string, string> = {}) {
    const store = new Map(Object.entries(seed))
    globals.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    }
  }

  afterEach(() => {
    delete globals.localStorage
  })

  it('returns the stored version when there is one', () => {
    useFakeStorage({ [LAST_SEEN_VERSION_KEY]: '1.3.0' })
    expect(resolveLastSeenVersion()).toBe('1.3.0')
  })

  it('infers a pre-1.3 install from any other Sooda key, so upgraders see What’s New', () => {
    useFakeStorage({ 'sooda:lang': 'fa' })
    expect(resolveLastSeenVersion()).toBe(PRE_V13_VERSION)
    expect(shouldShowWhatsNew('1.3.0', resolveLastSeenVersion())).toBe(true)
  })

  it('treats a genuinely empty storage as a first install', () => {
    useFakeStorage()
    expect(resolveLastSeenVersion()).toBeNull()
    expect(shouldShowWhatsNew('1.3.0', resolveLastSeenVersion())).toBe(false)
  })

  it('falls back to a first install when storage throws', () => {
    globals.localStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(resolveLastSeenVersion()).toBeNull()
  })
})
