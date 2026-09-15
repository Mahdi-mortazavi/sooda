import { describe, expect, it, vi } from 'vitest'
import { createTourEventQueue } from './eventQueue'
import type { TourEvent } from './events'
import type { LessonStep, SandboxState, TourCtx } from './types'

const tap = (name: string): TourEvent => ({ type: 'action', name })

/** A refresh whose resolution the test controls, so interleaving can be forced. */
function deferredRefresh() {
  const resolvers: (() => void)[] = []
  return {
    resolvers,
    refresh: () => new Promise<void>((resolve) => resolvers.push(resolve)),
    /** Let every refresh issued so far complete, then hand control back to the queue. */
    async releaseAll() {
      while (resolvers.length > 0) {
        resolvers.shift()?.()
        await Promise.resolve()
        await Promise.resolve()
      }
    },
  }
}

describe('createTourEventQueue', () => {
  it('refreshes the snapshot before judging, every time', async () => {
    const order: string[] = []
    const queue = createTourEventQueue({
      refresh: async () => {
        order.push('refresh')
      },
      judge: (event) => {
        order.push(`judge:${event.type === 'action' ? event.name : event.type}`)
        return false
      },
      onSatisfied: () => order.push('satisfied'),
    })
    queue.push(tap('a'))
    queue.push(tap('b'))
    await queue.drained()
    expect(order).toEqual(['refresh', 'judge:a', 'refresh', 'judge:b'])
  })

  it('judges one event at a time even when a burst arrives during a refresh', async () => {
    const gate = deferredRefresh()
    let inFlight = 0
    let overlapped = false
    const queue = createTourEventQueue({
      refresh: gate.refresh,
      judge: () => {
        inFlight += 1
        if (inFlight > 1) overlapped = true
        inFlight -= 1
        return false
      },
      onSatisfied: vi.fn(),
    })
    // All three land while the first refresh is still outstanding.
    queue.push(tap('a'))
    queue.push(tap('b'))
    queue.push(tap('c'))
    expect(gate.resolvers).toHaveLength(1)
    await gate.releaseAll()
    await queue.drained()
    expect(overlapped).toBe(false)
  })

  it('keeps arrival order', async () => {
    const seen: string[] = []
    const queue = createTourEventQueue({
      refresh: () => Promise.resolve(),
      judge: (event) => {
        if (event.type === 'action') seen.push(event.name)
        return false
      },
      onSatisfied: vi.fn(),
    })
    for (const name of ['a', 'b', 'c', 'd']) queue.push(tap(name))
    await queue.drained()
    expect(seen).toEqual(['a', 'b', 'c', 'd'])
  })

  it('advances once and only once when two queued events would both satisfy the step', async () => {
    const onSatisfied = vi.fn()
    const judge = vi.fn(() => true)
    const queue = createTourEventQueue({ refresh: () => Promise.resolve(), judge, onSatisfied })
    queue.push(tap('a'))
    queue.push(tap('b'))
    await queue.drained()
    expect(onSatisfied).toHaveBeenCalledTimes(1)
    // The second event is dropped rather than judged against a step already passed.
    expect(judge).toHaveBeenCalledTimes(1)
    expect(queue.closed).toBe(true)
  })

  it('ignores anything pushed after the step has passed', async () => {
    const judge = vi.fn(() => true)
    const queue = createTourEventQueue({ refresh: () => Promise.resolve(), judge, onSatisfied: vi.fn() })
    queue.push(tap('a'))
    await queue.drained()
    queue.push(tap('b'))
    await queue.drained()
    expect(judge).toHaveBeenCalledTimes(1)
  })

  it('is closed before onSatisfied runs, so an event it emits cannot re-enter', async () => {
    const judge = vi.fn(() => true)
    const queue: { current: ReturnType<typeof createTourEventQueue> | null } = { current: null }
    queue.current = createTourEventQueue({
      refresh: () => Promise.resolve(),
      judge,
      // A step's `advance` navigates, and navigating emits.
      onSatisfied: () => queue.current?.push(tap('side-effect')),
    })
    queue.current.push(tap('a'))
    await queue.current.drained()
    expect(judge).toHaveBeenCalledTimes(1)
  })

  it('drops what is queued when the step is torn down mid-refresh', async () => {
    const gate = deferredRefresh()
    const judge = vi.fn(() => false)
    const queue = createTourEventQueue({ refresh: gate.refresh, judge, onSatisfied: vi.fn() })
    queue.push(tap('a'))
    queue.push(tap('b'))
    queue.close()
    await gate.releaseAll()
    await queue.drained()
    expect(judge).not.toHaveBeenCalled()
    expect(queue.closed).toBe(true)
  })

  it('closes idempotently, and never satisfies after closing', async () => {
    const onSatisfied = vi.fn()
    const queue = createTourEventQueue({ refresh: () => Promise.resolve(), judge: () => true, onSatisfied })
    queue.close()
    queue.close()
    queue.push(tap('a'))
    await queue.drained()
    expect(onSatisfied).not.toHaveBeenCalled()
  })

  it('keeps going when a refresh rejects — a stale snapshot beats a dead step', async () => {
    const judge = vi.fn(() => false)
    const queue = createTourEventQueue({
      refresh: () => Promise.reject(new Error('dexie is having a day')),
      judge,
      onSatisfied: vi.fn(),
    })
    queue.push(tap('a'))
    queue.push(tap('b'))
    await queue.drained()
    expect(judge).toHaveBeenCalledTimes(2)
  })

  it('treats a predicate that throws as "not yet" rather than wedging the lesson', async () => {
    const onSatisfied = vi.fn()
    let calls = 0
    const queue = createTourEventQueue({
      refresh: () => Promise.resolve(),
      judge: () => {
        calls += 1
        if (calls === 1) throw new Error('lesson bug')
        return true
      },
      onSatisfied,
    })
    queue.push(tap('a'))
    queue.push(tap('b'))
    await queue.drained()
    expect(calls).toBe(2)
    expect(onSatisfied).toHaveBeenCalledTimes(1)
  })

  it('drains to a resolved promise when it has never been used', async () => {
    const queue = createTourEventQueue({
      refresh: () => Promise.resolve(),
      judge: () => false,
      onSatisfied: vi.fn(),
    })
    await expect(queue.drained()).resolves.toBeUndefined()
  })
})


/**
 * The hazard the refresh rule exists to close, wired the way `Coach` wires it: a step whose
 * condition reads the practice store rather than the event, against a store that only
 * settles a tick after the event is emitted.
 */
describe('the refresh rule, end to end with a stub ctx', () => {
  function stubCtx(): TourCtx & { store: { products: number }; refreshes: number } {
    const empty: SandboxState = { products: [], observations: [], profile: null, lastResult: null }
    const ctx = {
      store: { products: 0 },
      refreshes: 0,
      sandbox: empty,
      emit: vi.fn(),
      navigate: () => Promise.resolve(),
      async refreshSandbox() {
        ctx.refreshes += 1
        // Dexie resolves on a later microtask; the point is that it is not synchronous.
        await Promise.resolve()
        ctx.sandbox = {
          ...empty,
          // Only the count matters here, so the rows are stand-ins.
          products: Array.from({ length: ctx.store.products }, () => ({}) as SandboxState['products'][number]),
        }
      },
    }
    return ctx
  }

  const step: Pick<LessonStep, 'expect'> = {
    expect: (_event, state) => state.products.length > 0,
  }

  it('passes on the very event that caused the write, not the one after it', async () => {
    const ctx = stubCtx()
    const onSatisfied = vi.fn()
    const queue = createTourEventQueue({
      refresh: () => ctx.refreshSandbox(),
      judge: (event) => step.expect(event, ctx.sandbox),
      onSatisfied,
    })

    // What a component does: write, then announce. Before the fix the snapshot read here
    // would still be the pre-write one and this event would be missed.
    ctx.store.products = 1
    queue.push({ type: 'action', name: 'save-product' })
    await queue.drained()

    expect(onSatisfied).toHaveBeenCalledTimes(1)
    expect(ctx.refreshes).toBe(1)
  })

  it('does not pass on an event that changed nothing', async () => {
    const ctx = stubCtx()
    const onSatisfied = vi.fn()
    const queue = createTourEventQueue({
      refresh: () => ctx.refreshSandbox(),
      judge: (event) => step.expect(event, ctx.sandbox),
      onSatisfied,
    })
    queue.push({ type: 'field:change', field: 'cost', value: '10' })
    await queue.drained()
    expect(onSatisfied).not.toHaveBeenCalled()
    expect(ctx.refreshes).toBe(1)
  })
})
