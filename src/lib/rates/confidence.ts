/** How much the estimate deserves to be believed — shown as a badge, never as a number. */

export type Confidence = 'low' | 'medium' | 'high'

/** Iranian CPI lands monthly; two missed releases and the file is no longer describing this market. */
export const STALE_DAYS = 60

/** λ below this and the answer is mostly borrowed from the index rather than from this shop's own books. */
const LAMBDA_LOW = 0.34

/** Above this the product's own history is doing most of the work. */
const LAMBDA_HIGH = 0.67

/** low when λ<0.34 or the rates file is older than STALE_DAYS; medium when λ<0.67; else high. */
export function confidenceOf(lambda: number, ratesUpdatedAt: string | null, now: number): Confidence {
  // An unknown or unparseable date cannot be shown to be fresh, so it counts as stale rather than as fine.
  // A bare 'YYYY-MM-DD' is parsed as UTC by spec, so this does not drift with the device timezone.
  const updated = ratesUpdatedAt === null ? NaN : Date.parse(ratesUpdatedAt)
  const stale = !Number.isFinite(updated) || now - updated > STALE_DAYS * 86_400_000

  const safe = Number.isFinite(lambda) ? lambda : 0
  if (safe < LAMBDA_LOW || stale) return 'low'
  if (safe < LAMBDA_HIGH) return 'medium'
  return 'high'
}
