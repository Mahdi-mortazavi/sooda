import { describe, expect, it } from 'vitest'
import { STALE_DAYS, confidenceOf } from './confidence'

const NOW = Date.parse('2026-09-15T00:00:00Z')
const daysAgo = (n: number): string => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10)

describe('STALE_DAYS', () => {
  it('is two missed CPI releases', () => {
    expect(STALE_DAYS).toBe(60)
  })
})

describe('confidenceOf', () => {
  const fresh = daysAgo(1)

  it('is high once the shop’s own history carries most of the weight', () => {
    expect(confidenceOf(0.67, fresh, NOW)).toBe('high')
    expect(confidenceOf(1, fresh, NOW)).toBe('high')
  })

  it('is medium in the middle band', () => {
    expect(confidenceOf(0.34, fresh, NOW)).toBe('medium')
    expect(confidenceOf(0.5, fresh, NOW)).toBe('medium')
    expect(confidenceOf(0.669, fresh, NOW)).toBe('medium')
  })

  it('is low when the estimate is mostly borrowed from the index', () => {
    expect(confidenceOf(0, fresh, NOW)).toBe('low')
    expect(confidenceOf(0.339, fresh, NOW)).toBe('low')
  })

  it('is low whatever lambda says once the rates file goes stale', () => {
    expect(confidenceOf(1, daysAgo(STALE_DAYS + 1), NOW)).toBe('low')
    expect(confidenceOf(0.5, daysAgo(365), NOW)).toBe('low')
  })

  it('still trusts a file exactly STALE_DAYS old', () => {
    expect(confidenceOf(1, daysAgo(STALE_DAYS), NOW)).toBe('high')
  })

  it('treats an unknown or unparseable date as stale, never as fine', () => {
    expect(confidenceOf(1, null, NOW)).toBe('low')
    expect(confidenceOf(1, 'yesterday', NOW)).toBe('low')
    expect(confidenceOf(1, '', NOW)).toBe('low')
  })

  it('does not choke on a non-finite lambda', () => {
    expect(confidenceOf(Number.NaN, fresh, NOW)).toBe('low')
  })

  it('reads a bare date as UTC, so it does not drift with the device timezone', () => {
    expect(confidenceOf(1, '2026-09-15', NOW)).toBe('high')
  })
})
