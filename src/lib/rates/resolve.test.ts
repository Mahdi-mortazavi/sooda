import { describe, expect, it } from 'vitest'
import type { StoreProfile } from '../db'
import { FALLBACK_CATEGORY, FALLBACK_IMPORT_DEPENDENCY, resolveRateSettings } from './resolve'

const profile: StoreProfile = { id: 'me', categories: ['food', 'home'], importDependency: 0 }

describe('resolveRateSettings', () => {
  it('falls back to the neutral default with neither a product setting nor a profile', () => {
    expect(resolveRateSettings({}, null)).toEqual({
      category: FALLBACK_CATEGORY,
      importDependency: FALLBACK_IMPORT_DEPENDENCY,
    })
  })

  it('takes the profile’s first category as the primary one', () => {
    expect(resolveRateSettings({}, profile)).toEqual({ category: 'food', importDependency: 0 })
  })

  it('lets the product override both', () => {
    expect(resolveRateSettings({ category: 'digital', importDependency: 1 }, profile)).toEqual({
      category: 'digital',
      importDependency: 1,
    })
  })

  it('keeps an import dependency of 0 rather than treating it as absent', () => {
    // 0 is falsy, so a `||` chain here would silently promote a domestic product to 0.5.
    expect(resolveRateSettings({ importDependency: 0 }, { ...profile, importDependency: 1 }).importDependency).toBe(0)
  })

  it('omits manualMonthlyPercent entirely when nothing overrides', () => {
    expect('manualMonthlyPercent' in resolveRateSettings({}, profile)).toBe(false)
  })

  it('prefers the product’s manual rate over the store-wide one', () => {
    expect(resolveRateSettings({ manualMonthlyPercent: 3 }, { ...profile, manualMonthlyPercent: 9 })).toMatchObject({
      manualMonthlyPercent: 3,
    })
  })

  it('uses the store-wide manual rate when the product has none', () => {
    expect(resolveRateSettings({}, { ...profile, manualMonthlyPercent: 9 })).toMatchObject({ manualMonthlyPercent: 9 })
  })

  it('keeps a manual rate of 0 — "this product does not move" is a real answer', () => {
    expect(resolveRateSettings({ manualMonthlyPercent: 0 }, profile)).toMatchObject({ manualMonthlyPercent: 0 })
  })

  it('does not read the profile’s category list when it is empty', () => {
    expect(resolveRateSettings({}, { id: 'me', categories: [], importDependency: 1 }).category).toBe(FALLBACK_CATEGORY)
  })
})
