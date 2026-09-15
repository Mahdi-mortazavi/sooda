/**
 * The single call the UI makes: a product's history plus the rates file in, one estimate out.
 * Pure — `now` is injected, nothing here reads the clock or storage, so the screen and the tests
 * can be pinned to the same instant. Loading the rates file is a separate concern and is not re-exported.
 */

import type { CategoryId, ImportDependency } from './categories'
import { blend, forecast, replacementNow, type BlendResult } from './blend'
import { confidenceOf, type Confidence } from './confidence'
import { estimatePersonal, usableObservations, MS_PER_MONTH, type RateObservation } from './estimate'
import { fxAt, fxTrend } from './fx'
import { categoryMonthlyPercent, type RatesFile } from './schema'

export { MS_PER_MONTH, estimatePersonal, checkOutlier, usableObservations, OUTLIER_UP, OUTLIER_DOWN } from './estimate'
export type { RateObservation, PersonalFit, OutlierVerdict } from './estimate'
export { FX_WINDOW_DAYS, fxLatest, fxAt, fxTrend } from './fx'
export { blend, forecast, replacementNow, MONTHLY_MIN, MONTHLY_MAX } from './blend'
export type { BlendInput, BlendResult } from './blend'
export { confidenceOf, STALE_DAYS } from './confidence'
export type { Confidence } from './confidence'

export interface ProductRateInput {
  observations: RateObservation[]
  category: CategoryId
  importDependency: ImportDependency
  manualMonthlyPercent?: number
  rates: RatesFile | null
  now: number
}

export interface ProductRate extends BlendResult {
  confidence: Confidence
  /** null when there is no observation to grow forward. */
  replacementNow: number | null
  ageMonths: number
  lastObservedAt: number | null
}

/** Everything the "what does this really cost me now?" panel needs, from one pinned instant. */
export function productRate(input: ProductRateInput): ProductRate {
  const { rates, now } = input
  const personal = estimatePersonal(input.observations, now)

  const result = blend({
    personal,
    categoryMonthlyPercent: rates ? categoryMonthlyPercent(rates, input.category) : null,
    overallMonthlyPercent: rates ? rates.cpi.overallMonthlyPercent : null,
    fxTrendMonthlyLog: rates ? fxTrend(rates.fx.series, now) : null,
    importDependency: input.importDependency,
    manualMonthlyPercent: input.manualMonthlyPercent,
  })

  // Excluded and non-positive readings are invisible to every part of the answer, not just to the fit.
  const points = usableObservations(input.observations)
  const last = points[points.length - 1]
  const confidence = confidenceOf(result.lambda, rates?.updatedAt ?? null, now)
  if (!last) {
    return { ...result, confidence, replacementNow: null, ageMonths: 0, lastObservedAt: null }
  }

  // The rate as of `now`, not the end of the series: a file carrying tomorrow's close must not leak into today.
  const fxNow = rates ? (fxAt(rates.fx.series, now) ?? undefined) : undefined

  return {
    ...result,
    confidence,
    /* With no rate at all there is nothing to grow the last cost by, so the honest restock
     * figure is "unknown" rather than "exactly what you last paid". */
    replacementNow:
      result.g === null && result.gDomestic === null
        ? null
        : replacementNow({
            lastCost: last.cost,
            lastObservedAt: last.observedAt,
            now,
            lastFx: last.fxAtDate,
            fxNow,
            importDependency: input.importDependency,
            gDomestic: result.gDomestic ?? 0,
            gProduct: result.g ?? 0,
          }),
    ageMonths: Math.max(0, (now - last.observedAt) / MS_PER_MONTH),
    lastObservedAt: last.observedAt,
  }
}

/** The same goods `months` out, or null when there was nothing to grow forward. */
export function forecastCost(rate: ProductRate, months: number): number | null {
  if (rate.replacementNow === null || rate.g === null) return null
  return forecast(rate.replacementNow, rate.g, months)
}
