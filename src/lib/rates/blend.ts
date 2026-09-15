/** Blending the three signals — the product's own history, its CPI category, and the dollar — into one rate. */

import type { ImportDependency } from './categories'
import { MS_PER_MONTH, type PersonalFit } from './estimate'

/** Nothing in an Iranian shop deflates 5% a month; below this the fit is reading a clearance sale, not a trend. */
export const MONTHLY_MIN = -0.05

/** 25%/month is ~1400%/year. Beyond this the fit is reading a data-entry error, not the economy. */
export const MONTHLY_MAX = 0.25

export interface BlendInput {
  personal: PersonalFit | null
  categoryMonthlyPercent: number | null
  overallMonthlyPercent: number | null
  fxTrendMonthlyLog: number | null
  importDependency: ImportDependency
  manualMonthlyPercent?: number
}

export interface BlendResult {
  g: number
  monthlyPercent: number
  lambda: number
  clamped: boolean
  manual: boolean
  gPersonal: number | null
  gPrior: number
  gDomestic: number
  /** Which signals actually contributed — this drives the "why is it this number?" copy. */
  used: { personal: boolean; category: boolean; fx: boolean }
}

/** A monthly percent → monthly log growth. At or below −100% the growth factor is ≤ 0 and has no log. */
function toLog(monthlyPercent: number | null | undefined): number | null {
  if (monthlyPercent === null || monthlyPercent === undefined) return null
  if (!Number.isFinite(monthlyPercent) || monthlyPercent <= -100) return null
  return Math.log1p(monthlyPercent / 100)
}

/**
 * λ = (n/(n+2))·min(1, span/3): trust the shop's own history once it has both enough readings
 * and enough calendar behind them. Clamped because a caller can hand in any PersonalFit it likes.
 */
function lambdaOf(personal: PersonalFit | null): number {
  if (!personal) return 0
  const n = Math.max(0, personal.n)
  const span = Math.max(0, personal.spanMonths)
  const byCount = Number.isFinite(n) ? n / (n + 2) : 1
  const bySpan = Number.isFinite(span) ? span / 3 : 1
  const lambda = byCount * Math.min(1, bySpan)
  if (!Number.isFinite(lambda)) return 0
  return Math.min(1, Math.max(0, lambda))
}

/** The three signals, weighted by how much of this product's price is really set abroad. */
/** Hold a monthly log rate inside the safety band, reporting whether it had to move. */
function clampMonthly(g: number): { g: number; clamped: boolean } {
  const safe = Number.isFinite(g) ? g : 0
  const rate = Math.expm1(safe)
  if (rate > MONTHLY_MAX) return { g: Math.log1p(MONTHLY_MAX), clamped: true }
  if (rate < MONTHLY_MIN) return { g: Math.log1p(MONTHLY_MIN), clamped: true }
  return { g: safe, clamped: false }
}

export function blend(input: BlendInput): BlendResult {
  const s = input.importDependency
  const gCat = toLog(input.categoryMonthlyPercent)
  const gOverall = toLog(input.overallMonthlyPercent)
  const gTrend =
    input.fxTrendMonthlyLog !== null && Number.isFinite(input.fxTrendMonthlyLog) ? input.fxTrendMonthlyLog : null

  // Half the dollar's own drift, half the general index. Either half alone still says something,
  // so a missing one leaves the other speaking for the whole FX leg rather than zeroing it.
  let gFx: number | null = null
  if (gTrend !== null && gOverall !== null) gFx = 0.5 * gTrend + 0.5 * gOverall
  else if (gTrend !== null) gFx = gTrend
  else if (gOverall !== null) gFx = gOverall

  const gPersonalRaw = input.personal?.g
  const gPersonal = gPersonalRaw !== undefined && Number.isFinite(gPersonalRaw) ? gPersonalRaw : null
  const lambda = gPersonal === null ? 0 : lambdaOf(input.personal)

  // A missing signal contributes 0 rather than removing the term: the app has to render a number either way.
  const gPrior = (1 - s) * (gCat ?? 0) + s * (gFx ?? 0)
  const gDomestic = lambda * (gPersonal ?? 0) + (1 - lambda) * (gCat ?? 0)

  const manualLog = toLog(input.manualMonthlyPercent)
  if (manualLog !== null) {
    return {
      g: manualLog,
      monthlyPercent: Math.expm1(manualLog) * 100,
      lambda,
      clamped: false,
      manual: true,
      gPersonal,
      gPrior,
      gDomestic,
      // The shopkeeper overrode every signal, so none of them explains the number on screen.
      used: { personal: false, category: false, fx: false },
    }
  }

  const blended = lambda * (gPersonal ?? 0) + (1 - lambda) * gPrior
  const headline = clampMonthly(blended)
  /* The domestic leg is bounded by the same band. It is not cosmetic: replacementNow's FX
   * path grows a cost by gDomestic, so leaving it unclamped lets an imported product's restock
   * figure outrun the very rate the card just told the user it was using. */
  const domestic = clampMonthly(gDomestic)
  const g = headline.g
  const clamped = headline.clamped || domestic.clamped

  return {
    g,
    monthlyPercent: Math.expm1(g) * 100,
    lambda,
    clamped,
    manual: false,
    gPersonal,
    gPrior,
    gDomestic: domestic.g,
    used: {
      personal: gPersonal !== null && lambda > 0,
      // At s = 1 the category term is multiplied by zero, so it did not contribute even when present.
      category: gCat !== null && s < 1,
      fx: gFx !== null && s > 0,
    },
  }
}

/**
 * What it costs to replace the goods today. With a stored FX rate the imported share rides the
 * dollar directly and only the domestic share is grown by CPI; otherwise the blended rate does it all.
 */
export function replacementNow(args: {
  lastCost: number
  lastObservedAt: number
  now: number
  lastFx?: number
  fxNow?: number
  importDependency: ImportDependency
  gDomestic: number
  gProduct: number
}): number {
  // A reading dated in the future (a skewed device clock, or a backup from one) would otherwise
  // run the growth backwards and quote a restock cost below what the shopkeeper actually paid.
  const ageMonths = Math.max(0, (args.now - args.lastObservedAt) / MS_PER_MONTH)
  const s = args.importDependency
  const { lastFx, fxNow } = args
  // Never divide by a rate that might be missing just to discover the ratio was going to be 1 anyway.
  const fxRatio =
    s > 0 && lastFx !== undefined && fxNow !== undefined && lastFx > 0 && fxNow > 0 && Number.isFinite(fxNow / lastFx)
      ? fxNow / lastFx
      : null
  const result =
    fxRatio !== null
      ? args.lastCost * Math.pow(fxRatio, s) * Math.exp((1 - s) * args.gDomestic * ageMonths)
      : args.lastCost * Math.exp(args.gProduct * ageMonths)
  return Number.isFinite(result) ? result : args.lastCost
}

/** R·e^{g·m} — the same goods, `months` from now. Left unrounded: rounding belongs at the display boundary. */
export function forecast(rNow: number, g: number, months: number): number {
  const result = rNow * Math.exp(g * months)
  return Number.isFinite(result) ? result : rNow
}
