import { describe, expect, it } from 'vitest'
import { validateMode } from './registry'
import { resolveReplacement } from './lens'

/*
 * Reported live: choosing "I know today's restock price" and leaving the field blank produced
 * exactly the same result as leaving "Estimate with inflation" selected — no error, no notice,
 * the choice simply had no effect. `resolveReplacement` only ever trusted a *supplied* figure
 * (`supplied > 0`); the field itself was `optional`, so the generic validator resolved a blank
 * box to 0 with nothing surfaced, and 0 fails that same `> 0` check and falls straight through
 * to the estimate. These tests hold the fix at the layer a shopkeeper actually meets it: the
 * field itself, through the same `validateMode` the calculator calls before computing anything.
 */

describe('the lens replacement field, once "I know today\'s price" is chosen', () => {
  const known = (replacement: string) => ({
    cost: '150000',
    margin: '25',
    price: '',
    months: '3',
    src: 'known',
    replacement,
  })

  it('is required: a blank value now errors instead of silently using the estimate', () => {
    const { errors, ok } = validateMode('profit', known(''))
    expect(ok).toBe(false)
    expect(errors['replacement']).toBe('required')
  })

  it('rejects zero the same way — 0 is not a real restock price either', () => {
    const { errors, ok } = validateMode('profit', known('0'))
    expect(ok).toBe(false)
    expect(errors['replacement']).toBe('notPositive')
  })

  it('accepts a real figure with no error', () => {
    const { errors, ok } = validateMode('profit', known('160000'))
    expect(ok).toBe(true)
    expect(errors['replacement']).toBeUndefined()
  })

  it('is not asked for at all while the estimate source is still selected', () => {
    const { errors, ok } = validateMode('profit', { cost: '150000', margin: '25', price: '', months: '3', src: 'inflation', replacement: '' })
    expect(ok).toBe(true)
    expect(errors['replacement']).toBeUndefined()
  })
})

describe('resolveReplacement (unchanged: the fix is that invalid input never reaches here now)', () => {
  const ctx = (src: string) => ({ monthlyInflationPercent: 3, roundingStep: 1000 as const, now: 0, state: { src } })

  it('still prefers a real supplied figure over the estimate', () => {
    expect(resolveReplacement(150_000, 3, { replacement: 160_000 }, ctx('known'))).toBe(160_000)
  })

  it('still falls back to the estimate when nothing was supplied (now unreachable via the UI)', () => {
    const viaEstimate = resolveReplacement(150_000, 3, {}, ctx('known'))
    const nominal = resolveReplacement(150_000, 3, {}, ctx('inflation'))
    expect(viaEstimate).toBe(nominal)
    expect(viaEstimate).toBeGreaterThan(150_000)
  })
})
