import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearBadge, isBadgeSupported, setStaleBadge } from './badge'

interface FakeBadging {
  setCalls: unknown[]
  clearCalls: number
}

const globals = globalThis as unknown as { navigator?: unknown }
let originalNavigator: PropertyDescriptor | undefined

/** navigator is a getter-only global in the node test environment, so it has to be redefined. */
function installNavigator(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
}

function useBadging(behaviour: 'resolve' | 'reject' = 'resolve'): FakeBadging {
  const fake: FakeBadging = { setCalls: [], clearCalls: 0 }
  const outcome = (): Promise<void> =>
    behaviour === 'reject' ? Promise.reject(new Error('denied')) : Promise.resolve()
  installNavigator({
    setAppBadge: (contents?: number) => {
      fake.setCalls.push(contents)
      return outcome()
    },
    clearAppBadge: () => {
      fake.clearCalls += 1
      return outcome()
    },
  })
  return fake
}

beforeEach(() => {
  originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
})

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else delete globals.navigator
})

describe('isBadgeSupported', () => {
  it('is true when both calls are present', () => {
    useBadging()
    expect(isBadgeSupported()).toBe(true)
  })

  it('is false on a platform without the API', () => {
    installNavigator({ onLine: true })
    expect(isBadgeSupported()).toBe(false)
  })

  it('is false when only half the API is present', () => {
    installNavigator({ setAppBadge: () => Promise.resolve() })
    expect(isBadgeSupported()).toBe(false)
  })
})

describe('setStaleBadge', () => {
  it('passes the count through', async () => {
    const fake = useBadging()
    await setStaleBadge(3)
    expect(fake.setCalls).toEqual([3])
    expect(fake.clearCalls).toBe(0)
  })

  it('clears at zero rather than badging a nothing', async () => {
    const fake = useBadging()
    await setStaleBadge(0)
    expect(fake.setCalls).toEqual([])
    expect(fake.clearCalls).toBe(1)
  })

  it('clears on a negative or non-finite count', async () => {
    const fake = useBadging()
    await setStaleBadge(-2)
    await setStaleBadge(Number.NaN)
    expect(fake.setCalls).toEqual([])
    expect(fake.clearCalls).toBe(2)
  })

  it('rounds a fractional count down to a whole badge', async () => {
    const fake = useBadging()
    await setStaleBadge(4.7)
    expect(fake.setCalls).toEqual([4])
  })

  it('is a silent no-op on an unsupported platform', async () => {
    installNavigator({ onLine: true })
    await expect(setStaleBadge(3)).resolves.toBeUndefined()
  })

  it('swallows a rejecting implementation', async () => {
    const fake = useBadging('reject')
    await expect(setStaleBadge(3)).resolves.toBeUndefined()
    expect(fake.setCalls).toEqual([3])
  })
})

describe('clearBadge', () => {
  it('calls through when supported', async () => {
    const fake = useBadging()
    await clearBadge()
    expect(fake.clearCalls).toBe(1)
  })

  it('is a silent no-op on an unsupported platform', async () => {
    installNavigator({ onLine: true })
    await expect(clearBadge()).resolves.toBeUndefined()
  })

  it('swallows a rejecting implementation', async () => {
    useBadging('reject')
    await expect(clearBadge()).resolves.toBeUndefined()
  })
})
