import { describe, expect, it } from 'vitest'
import { isRounded, isRoundingStep, ROUNDING_STEPS, roundUpTo } from './rounding'

describe('roundUpTo', () => {
  it('leaves values untouched when rounding is off', () => {
    expect(roundUpTo(130530.876, 0)).toBe(130530.88)
    expect(roundUpTo(0, 0)).toBe(0)
  })

  it('always rounds up so margin is never lost', () => {
    expect(roundUpTo(130530.88, 1000)).toBe(131000)
    expect(roundUpTo(130530.88, 5000)).toBe(135000)
    expect(roundUpTo(130530.88, 10000)).toBe(140000)
    expect(roundUpTo(130530.88, 50000)).toBe(150000)
  })

  it('leaves exact multiples alone', () => {
    expect(roundUpTo(135000, 5000)).toBe(135000)
    expect(roundUpTo(15000, 5000)).toBe(15000)
    expect(roundUpTo(1000, 1000)).toBe(1000)
    expect(roundUpTo(0, 1000)).toBe(0)
  })

  it('rounds a value one unit above a step up to the next one', () => {
    expect(roundUpTo(135000.01, 5000)).toBe(140000)
  })

  it('rounds negative values toward zero (up, numerically)', () => {
    expect(roundUpTo(-1500, 1000)).toBe(-1000)
  })

  it('passes non-finite values through', () => {
    expect(Number.isNaN(roundUpTo(NaN, 1000))).toBe(true)
    expect(roundUpTo(Infinity, 1000)).toBe(Infinity)
  })
})

describe('isRounded', () => {
  it('is false when rounding is off or the value already sits on a step', () => {
    expect(isRounded(130530.88, 0)).toBe(false)
    expect(isRounded(135000, 5000)).toBe(false)
  })

  it('is true when the price actually moved', () => {
    expect(isRounded(130530.88, 5000)).toBe(true)
  })
})

describe('isRoundingStep', () => {
  it('accepts every declared step and rejects anything else', () => {
    for (const s of ROUNDING_STEPS) expect(isRoundingStep(s)).toBe(true)
    expect(isRoundingStep(2000)).toBe(false)
    expect(isRoundingStep('1000')).toBe(false)
    expect(isRoundingStep(null)).toBe(false)
  })
})
