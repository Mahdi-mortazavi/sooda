/** Inflation-adjusted ("real") profit: what it costs to *replace* the goods, not what they cost last time. */

import inflationData from '../data/inflation.json'
import { MAX_VALUE, round2 } from './calc'

export interface InflationSource {
  /** MONTHLY, not annual. Iran's CPI is published monthly and the engine works monthly. */
  monthlyPercent: number
  source: string
  /** Persian rendering of the same source, so the provenance line is not English inside an RTL UI. */
  sourceFa?: string
  sourceUrl: string
  updatedAt: string
  confidence?: 'primary' | 'secondary'
}

/* JSON imports widen `confidence` to plain string, so the union is re-narrowed by hand rather than cast away. */
const bundled: {
  monthlyPercent: number
  source: string
  sourceFa?: string
  sourceUrl: string
  updatedAt: string
  confidence: string
} =
  inflationData

/** The CPI figure shipped with the build — never fetched, because the precache skips .json. */
export const INFLATION_DEFAULT: InflationSource = {
  monthlyPercent: bundled.monthlyPercent,
  source: bundled.source,
  sourceFa: bundled.sourceFa,
  sourceUrl: bundled.sourceUrl,
  updatedAt: bundled.updatedAt,
  confidence: bundled.confidence === 'primary' ? 'primary' : 'secondary',
}

export const INFLATION_STORAGE_KEY = 'sooda:inflation-monthly'

/**
 * The v1.4-and-earlier key, which held an ANNUAL percent.
 *
 * The meaning of the number changed in v1.5, so the key had to change with it. Reading the old
 * key as if it were monthly would turn one shopkeeper's carefully chosen "89% a year" into
 * 89% a *month* — a factor of 1.89^12 on every restock estimate they see. A stored value is
 * migrated once, by conversion, and the old key is then removed.
 */
export const LEGACY_ANNUAL_STORAGE_KEY = 'sooda:inflation'

/** An annual percent → the equivalent compounding monthly percent. 89%/yr is 5.45%/mo. */
export function annualToMonthlyPercent(annualPercent: number): number {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100
}

/* At or below −100% the growth factor is ≤ 0 and every downstream figure turns to NaN, so such an
   override is treated as garbage rather than allowed to poison the results. */
function parseOverride(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null
  const pct = Number(raw)
  if (!Number.isFinite(pct) || pct <= -100 || Math.abs(pct) > MAX_VALUE) return null
  return pct
}

function readOverride(): number | null {
  try {
    const current = parseOverride(localStorage.getItem(INFLATION_STORAGE_KEY))
    if (current !== null) return current

    // Nothing under the new key: convert a v1.4 annual override exactly once, then retire it.
    const legacy = parseOverride(localStorage.getItem(LEGACY_ANNUAL_STORAGE_KEY))
    if (legacy === null) return null
    const monthly = annualToMonthlyPercent(legacy)
    if (!Number.isFinite(monthly)) return null
    localStorage.setItem(INFLATION_STORAGE_KEY, String(monthly))
    localStorage.removeItem(LEGACY_ANNUAL_STORAGE_KEY)
    return monthly
  } catch {
    // storage unavailable
    return null
  }
}

/** The user's override if they set one, otherwise the bundled default. */
/** The source name in the reader's language, falling back to the canonical one. */
export function inflationSourceLabel(lang: 'en' | 'fa'): string {
  return (lang === 'fa' ? INFLATION_DEFAULT.sourceFa : undefined) ?? INFLATION_DEFAULT.source
}

export function readMonthlyInflationPercent(): number {
  return readOverride() ?? INFLATION_DEFAULT.monthlyPercent
}

/** null clears the override and restores the bundled default. */
export function storeMonthlyInflationPercent(pct: number | null): void {
  try {
    // The legacy key goes too, or the next read would migrate it straight back in.
    if (pct === null) {
      localStorage.removeItem(INFLATION_STORAGE_KEY)
      localStorage.removeItem(LEGACY_ANNUAL_STORAGE_KEY)
    } else {
      localStorage.setItem(INFLATION_STORAGE_KEY, String(pct))
      localStorage.removeItem(LEGACY_ANNUAL_STORAGE_KEY)
    }
  } catch {
    // best-effort persistence
  }
}

export function hasInflationOverride(): boolean {
  return readOverride() !== null
}

/**
 * A MONTHLY percent → the fraction the engine compounds. Never rounded: it feeds every result.
 *
 * Until v1.5 this took an annual percent and took its twelfth root. Iran's CPI is published
 * monthly, and deriving a monthly pace from a point-to-point annual figure overstates it badly
 * while inflation is decelerating — 89%/yr implies 5.45%/mo against a reported 3.4%.
 */
export function monthlyRateFromPercent(monthlyPercent: number): number {
  return monthlyPercent / 100
}

/** R = c·(1+r)^m — what the same goods will cost to buy again after `months`. */
export function replacementCost(cost: number, monthlyRate: number, months: number): number {
  return round2(cost * Math.pow(1 + monthlyRate, months))
}

/** S* = R·(1 + profitPercent/100) — the price that earns the target margin over replacement, not over cost. */
export function suggestedPrice(replacement: number, profitPercent: number): number {
  return round2(replacement * (1 + profitPercent / 100))
}

/** (S/R − 1)·100 — the margin actually earned once replacement is paid for. */
export function realProfitPercent(sellingPrice: number, replacement: number): number {
  return round2((sellingPrice / replacement - 1) * 100)
}

export type ProfitStatus = 'healthy' | 'thin' | 'losing'

/** losing: real ≤ 0. healthy: real ≥ 0.8·target (or any real > 0 when target ≤ 0). thin: in between. */
export function profitStatus(realPercent: number, targetPercent: number): ProfitStatus {
  if (realPercent <= 0) return 'losing'
  if (targetPercent <= 0) return 'healthy'
  return realPercent >= 0.8 * targetPercent ? 'healthy' : 'thin'
}

/** Horizons offered by the "how long will this sit on the shelf?" lens. */
export const LENS_MONTHS = [0, 1, 3, 6, 12] as const

export type LensMonths = (typeof LENS_MONTHS)[number]
