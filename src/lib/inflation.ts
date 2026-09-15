/** Inflation-adjusted ("real") profit: what it costs to *replace* the goods, not what they cost last time. */

import inflationData from '../data/inflation.json'
import { MAX_VALUE, round2 } from './calc'

export interface InflationSource {
  annualPercent: number
  source: string
  /** Persian rendering of the same source, so the provenance line is not English inside an RTL UI. */
  sourceFa?: string
  sourceUrl: string
  updatedAt: string
  confidence?: 'primary' | 'secondary'
}

/* JSON imports widen `confidence` to plain string, so the union is re-narrowed by hand rather than cast away. */
const bundled: {
  annualPercent: number
  source: string
  sourceFa?: string
  sourceUrl: string
  updatedAt: string
  confidence: string
} =
  inflationData

/** The CPI figure shipped with the build — never fetched, because the precache skips .json. */
export const INFLATION_DEFAULT: InflationSource = {
  annualPercent: bundled.annualPercent,
  source: bundled.source,
  sourceFa: bundled.sourceFa,
  sourceUrl: bundled.sourceUrl,
  updatedAt: bundled.updatedAt,
  confidence: bundled.confidence === 'primary' ? 'primary' : 'secondary',
}

export const INFLATION_STORAGE_KEY = 'sooda:inflation'

/* At or below −100%/yr the annual growth factor is ≤ 0 and a fractional power of it is NaN, so such an
   override is treated as garbage rather than allowed to poison every downstream figure. */
function parseOverride(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null
  const pct = Number(raw)
  if (!Number.isFinite(pct) || pct <= -100 || Math.abs(pct) > MAX_VALUE) return null
  return pct
}

function readOverride(): number | null {
  try {
    return parseOverride(localStorage.getItem(INFLATION_STORAGE_KEY))
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

export function readAnnualInflationPercent(): number {
  return readOverride() ?? INFLATION_DEFAULT.annualPercent
}

/** null clears the override and restores the bundled default. */
export function storeAnnualInflationPercent(pct: number | null): void {
  try {
    if (pct === null) localStorage.removeItem(INFLATION_STORAGE_KEY)
    else localStorage.setItem(INFLATION_STORAGE_KEY, String(pct))
  } catch {
    // best-effort persistence
  }
}

export function hasInflationOverride(): boolean {
  return readOverride() !== null
}

/** Annual FRACTION (0.40 = 40%) → the equivalent compounding monthly rate. Never rounded: it feeds every result. */
export function monthlyRate(annual: number): number {
  if (annual === 0) return 0
  return Math.pow(1 + annual, 1 / 12) - 1
}

export function monthlyRateFromPercent(annualPercent: number): number {
  return monthlyRate(annualPercent / 100)
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
