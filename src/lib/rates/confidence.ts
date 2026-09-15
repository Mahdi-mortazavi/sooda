/** How much the estimate deserves to be believed — shown as a badge, never as a number. */

export type Confidence = 'low' | 'medium' | 'high'

/** Iranian CPI lands monthly; two missed releases and the file is no longer describing this market. */
export const STALE_DAYS = 60

/** λ below this and the answer is mostly borrowed from the index rather than from this shop's own books. */
const LAMBDA_LOW = 0.34

/** Above this the product's own history is doing most of the work. */
const LAMBDA_HIGH = 0.67

/**
 * low when λ<0.34; medium when λ<0.67; else high — and a stale rates file drops it one step,
 * but only while the file is still doing some of the work.
 *
 * The staleness penalty used to be absolute, which had two bad consequences. Sooda ships with
 * no national figures at all, so `updatedAt` is null, so *every* product read "low" however
 * many prices its owner had recorded — a badge that is constant carries no information. And it
 * was wrong on its own terms: at a high λ the answer is mostly the shop's own books, and the
 * age of a national index that barely contributed should not decide how much to believe it.
 */
export function confidenceOf(lambda: number, ratesUpdatedAt: string | null, now: number): Confidence {
  // An unknown or unparseable date cannot be shown to be fresh, so it counts as stale rather than as fine.
  // A bare 'YYYY-MM-DD' is parsed as UTC by spec, so this does not drift with the device timezone.
  const updated = ratesUpdatedAt === null ? NaN : Date.parse(ratesUpdatedAt)
  const stale = !Number.isFinite(updated) || now - updated > STALE_DAYS * 86_400_000

  const safe = Number.isFinite(lambda) ? lambda : 0
  const base: Confidence = safe < LAMBDA_LOW ? 'low' : safe < LAMBDA_HIGH ? 'medium' : 'high'
  if (!stale) return base
  // Proportional, not absolute: the file can only cost what the file contributed.
  return base === 'high' ? 'medium' : 'low'
}
