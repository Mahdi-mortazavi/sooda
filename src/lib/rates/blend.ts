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
  /** null when not one signal was available. "No estimate" is an answer; 0%/month is a claim. */
  g: number | null
  monthlyPercent: number | null
  lambda: number
  /** Which end of the safety band the headline hit, if either. */
  clamped: 'high' | 'low' | null
  manual: boolean
  gPersonal: number | null
  gPrior: number | null
  gDomestic: number | null
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

/** Hold a monthly log rate inside the safety band, reporting which end it hit. */
function clampMonthly(g: number): { g: number; clamped: 'high' | 'low' | null } {
  const safe = Number.isFinite(g) ? g : 0
  const rate = Math.expm1(safe)
  if (rate > MONTHLY_MAX) return { g: Math.log1p(MONTHLY_MAX), clamped: 'high' }
  if (rate < MONTHLY_MIN) return { g: Math.log1p(MONTHLY_MIN), clamped: 'low' }
  return { g: safe, clamped: null }
}

/**
 * Combine whichever of two legs exist, renormalising by the weight actually used.
 *
 * The distinction matters more than it looks. Treating a missing leg as 0 in log space is
 * not an abstention, it is the claim "this signal says prices are flat" — so an imported
 * product with no dollar data used to be told its price was not moving at all, and a clean
 * personal trend was dragged toward zero by a rates file that simply had not arrived yet.
 */
function combine(a: number | null, aWeight: number, b: number | null, bWeight: number): number | null {
  let sum = 0
  let weight = 0
  if (a !== null && aWeight > 0) {
    sum += aWeight * a
    weight += aWeight
  }
  if (b !== null && bWeight > 0) {
    sum += bWeight * b
    weight += bWeight
  }
  return weight > 0 ? sum / weight : null
}

export function blend(input: BlendInput): BlendResult {
  const s = input.importDependency
  const gCat = toLog(input.categoryMonthlyPercent)
  const gOverall = toLog(input.overallMonthlyPercent)
  const gTrend =
    input.fxTrendMonthlyLog !== null && Number.isFinite(input.fxTrendMonthlyLog) ? input.fxTrendMonthlyLog : null

  // Half the dollar's own drift, half the general index. Either half alone still says
  // something, so a missing one leaves the other speaking for the whole FX leg.
  const gFx = combine(gTrend, 0.5, gOverall, 0.5)

  const gPersonalRaw = input.personal?.g
  const gPersonal = gPersonalRaw !== undefined && Number.isFinite(gPersonalRaw) ? gPersonalRaw : null
  const lambda = gPersonal === null ? 0 : lambdaOf(input.personal)

  const gPrior = combine(gCat, 1 - s, gFx, s)
  const gDomesticRaw = combine(gPersonal, lambda, gCat, 1 - lambda)

  const manualLog = toLog(input.manualMonthlyPercent)
  if (manualLog !== null) {
    return {
      g: manualLog,
      monthlyPercent: Math.expm1(manualLog) * 100,
      lambda,
      clamped: null,
      manual: true,
      gPersonal,
      gPrior,
      /* The override has to win on the restock path too. replacementNow spends gDomestic,
       * so returning the auto-computed one here would quote a cost the card just said it
       * was not using — and unclamped, at that. */
      gDomestic: manualLog,
      // The shopkeeper overrode every signal, so none of them explains the number on screen.
      used: { personal: false, category: false, fx: false },
    }
  }

  const blended = combine(gPersonal, lambda, gPrior, 1 - lambda)
  if (blended === null) {
    // Nothing to go on at all. The card says so rather than printing a confident zero.
    return {
      g: null,
      monthlyPercent: null,
      lambda,
      clamped: null,
      manual: false,
      gPersonal,
      gPrior,
      gDomestic: gDomesticRaw,
      used: { personal: false, category: false, fx: false },
    }
  }

  const headline = clampMonthly(blended)
  /* The domestic leg is bounded by the same band. It is not cosmetic: replacementNow's FX
   * path grows a cost by gDomestic, so leaving it unclamped lets an imported product's
   * restock figure outrun the very rate the card just told the user it was using. */
  const domestic = gDomesticRaw === null ? null : clampMonthly(gDomesticRaw).g

  return {
    g: headline.g,
    monthlyPercent: Math.expm1(headline.g) * 100,
    lambda,
    // Only the headline's own clamp, because the headline is what the warning sits next to.
    clamped: headline.clamped,
    manual: false,
    gPersonal,
    gPrior,
    gDomestic: domestic,
    used: {
      personal: gPersonal !== null && lambda > 0,
      // At s = 1 the category term carries no weight, and at lambda = 1 nor does the prior.
      category: gCat !== null && s < 1 && lambda < 1,
      // gOverall standing in for a missing trend is not the dollar moving; do not claim it is.
      fx: gTrend !== null && s > 0,
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
