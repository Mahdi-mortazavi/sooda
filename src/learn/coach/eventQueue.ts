/**
 * The step's judge, and the reason it is a queue rather than a callback.
 *
 * The plan's refresh rule says the practice store is re-read before `expect` sees an event,
 * and `refreshSandbox` is async because Dexie is. That turns a synchronous predicate into an
 * interleaving problem: a burst of events — a keystroke, a commit, a result — can all arrive
 * while the first refresh is still in flight, and judging them concurrently would let two
 * of them satisfy the same step, or let the second be judged against a snapshot taken for
 * the third.
 *
 * So events are judged strictly one at a time, in arrival order, each against a refresh of
 * its own, and the queue closes itself the instant one of them passes. No React here, so the
 * part that is genuinely easy to get wrong is testable without a DOM.
 */

import type { TourEvent } from './events'

export interface TourEventQueueOptions {
  /** Awaited before each event is judged; the snapshot `judge` reads must be current. */
  refresh: () => Promise<void>
  /** The step's `expect`, already bound to its state. Exceptions count as "not satisfied". */
  judge: (event: TourEvent) => boolean
  /** Called at most once, ever. The queue is closed before it is called. */
  onSatisfied: () => void
}

export interface TourEventQueue {
  /** Accept an event for judging. Returns immediately; judging happens in order, behind it. */
  push(event: TourEvent): void
  /** Stop accepting, drop anything still waiting. Idempotent — the step is over either way. */
  close(): void
  /** True once satisfied or closed. */
  readonly closed: boolean
  /** Resolves when nothing is queued or in flight. For tests; the runner never awaits it. */
  drained(): Promise<void>
}

export function createTourEventQueue(options: TourEventQueueOptions): TourEventQueue {
  const pending: TourEvent[] = []
  let closed = false
  let running = false
  let waiters: (() => void)[] = []

  const releaseWaiters = () => {
    const current = waiters
    waiters = []
    for (const resolve of current) resolve()
  }

  const run = async () => {
    running = true
    try {
      for (;;) {
        if (closed) break
        const event = pending.shift()
        if (event === undefined) break
        try {
          await options.refresh()
        } catch {
          /* A refresh that failed leaves the snapshot stale rather than absent. Judging the
           * event anyway is the lesser wrong: the step can still pass on what the event
           * itself says, which is what most steps read. */
        }
        // `close` may have been called while the refresh was in flight.
        if (closed) break
        let satisfied = false
        try {
          satisfied = options.judge(event)
        } catch {
          /* A predicate that throws is a lesson bug. Trapping the user in the step would be
           * the worse failure; the lessons suite is where it surfaces. */
        }
        if (satisfied) {
          // Closed *before* the callback, so anything it emits synchronously is not judged
          // against a step that has already been passed.
          closed = true
          pending.length = 0
          options.onSatisfied()
          break
        }
      }
    } finally {
      running = false
      if (closed) pending.length = 0
      releaseWaiters()
    }
  }

  return {
    push(event) {
      if (closed) return
      pending.push(event)
      if (!running) void run()
    },
    close() {
      closed = true
      pending.length = 0
      if (!running) releaseWaiters()
    },
    get closed() {
      return closed
    },
    drained() {
      if (!running && pending.length === 0) return Promise.resolve()
      return new Promise<void>((resolve) => waiters.push(resolve))
    },
  }
}
