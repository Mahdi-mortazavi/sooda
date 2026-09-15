import type { AppLanguage } from './numbers'

/** A date expressed in whichever calendar produced it. */
interface CalParts {
  y: number
  m: number
  d: number
}

const MS_PER_DAY = 86_400_000
/** Mean Persian month length — only ever used as a search seed, never as an answer. */
const MEAN_MONTH_MS = 30.436_875 * MS_PER_DAY

/* Latin digits keep the parsing simple; display formatting is a separate concern. */
const jalaliPartsFormatter = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

/** Split a timestamp into Persian-calendar year/month/day. */
function jalaliParts(ms: number): CalParts {
  const parts = jalaliPartsFormatter.formatToParts(new Date(ms))
  let y = 0
  let m = 0
  let d = 0
  for (const p of parts) {
    if (p.type === 'year') y = Number.parseInt(p.value, 10)
    else if (p.type === 'month') m = Number.parseInt(p.value, 10)
    else if (p.type === 'day') d = Number.parseInt(p.value, 10)
  }
  return { y, m, d }
}

function monthIndex(p: CalParts): number {
  return p.y * 12 + (p.m - 1)
}

/**
 * Step a timestamp by whole **Persian** months — the calendar Iranian instalment
 * contracts are written in. Short months clamp (31 Farvardin + 6 months → 30 Mehr).
 * Time of day is preserved.
 */
export function addMonths(ms: number, months: number): number {
  if (months === 0) return ms
  const start = jalaliParts(ms)
  const targetIndex = monthIndex(start) + months

  // Converge on the right Persian month from a mean-length seed.
  let cursor = ms + months * MEAN_MONTH_MS
  for (let i = 0; i < 4; i++) {
    const drift = targetIndex - monthIndex(jalaliParts(cursor))
    if (drift === 0) break
    cursor += drift * MEAN_MONTH_MS
  }
  // If the seed still overshot, walk whole months back into place.
  while (monthIndex(jalaliParts(cursor)) > targetIndex) cursor -= MS_PER_DAY
  while (monthIndex(jalaliParts(cursor)) < targetIndex) cursor += MS_PER_DAY

  // Land on the same day-of-month, then clamp back if that month is shorter.
  cursor += (start.d - jalaliParts(cursor).d) * MS_PER_DAY
  while (monthIndex(jalaliParts(cursor)) > targetIndex) cursor -= MS_PER_DAY

  // Restore the original wall-clock time, which the day arithmetic may have nudged across a DST edge.
  const from = new Date(ms)
  const to = new Date(cursor)
  to.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds())
  return to.getTime()
}

/**
 * Whole Persian months elapsed from `fromMs` to `toMs`: the largest `k` for which
 * `addMonths(fromMs, k) <= toMs`. Floored, never negative.
 */
export function monthsBetween(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0
  let k = monthIndex(jalaliParts(toMs)) - monthIndex(jalaliParts(fromMs))
  // The month-index difference can be one too high when the day (or time) of month
  // has not come around yet; clamping against addMonths keeps the two exactly inverse.
  while (k > 0 && addMonths(fromMs, k) > toMs) k--
  return Math.max(0, k)
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function formatter(lang: AppLanguage, withTime: boolean): Intl.DateTimeFormat {
  const key = `${lang}:${withTime}`
  let fmt = dateFormatters.get(key)
  if (!fmt) {
    // fa-IR's default calendar is already `persian`, so Jalali comes for free.
    fmt = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
    })
    dateFormatters.set(key, fmt)
  }
  return fmt
}

/** Jalali for Persian, Gregorian for English. */
export function formatDate(ms: number, lang: AppLanguage): string {
  return formatter(lang, false).format(ms)
}

export function formatDateTime(ms: number, lang: AppLanguage): string {
  return formatter(lang, true).format(ms)
}
