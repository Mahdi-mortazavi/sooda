import { describe, expect, it, vi } from 'vitest'
import { emitTour, isTourListening, subscribeTour, TOUR_ACTIONS, TOUR_SHEETS, type TourEvent } from './events'

const TAP: TourEvent = { type: 'action', name: 'calculate' }

describe('emitTour', () => {
  it('does nothing, and costs nothing, with no tour listening', () => {
    expect(isTourListening()).toBe(false)
    expect(() => emitTour(TAP)).not.toThrow()
  })

  it('delivers to every listener and stops once they have all gone', () => {
    const first = vi.fn()
    const second = vi.fn()
    const offFirst = subscribeTour(first)
    const offSecond = subscribeTour(second)
    emitTour(TAP)
    expect(first).toHaveBeenCalledWith(TAP)
    expect(second).toHaveBeenCalledWith(TAP)

    offFirst()
    emitTour(TAP)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)

    offSecond()
    expect(isTourListening()).toBe(false)
  })

  it('still reaches the later listener when an earlier one unsubscribes mid-emit', () => {
    const second = vi.fn()
    const offSecond = subscribeTour(second)
    const offFirst = subscribeTour(() => offFirst())
    // Subscribed second but registered first in the array — order matters for this one.
    const offThird = subscribeTour(() => offSecond())
    emitTour(TAP)
    expect(second).toHaveBeenCalledTimes(1)
    offFirst()
    offSecond()
    offThird()
    expect(isTourListening()).toBe(false)
  })

  it('tolerates an unsubscribe called twice', () => {
    const off = subscribeTour(vi.fn())
    off()
    expect(() => off()).not.toThrow()
    expect(isTourListening()).toBe(false)
  })
})

describe('the canonical name lists', () => {
  it('are kebab-case and free of duplicates, so a lesson and a component agree', () => {
    for (const names of [TOUR_SHEETS, TOUR_ACTIONS]) {
      expect(new Set(names).size).toBe(names.length)
      for (const name of names) expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/)
    }
  })
})
