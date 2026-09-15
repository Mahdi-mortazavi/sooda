/** The FX leg of the model: reading a daily USD series and turning its recent shape into a monthly log slope. */

import { MS_PER_MONTH } from './estimate'
import type { FxPoint } from './schema'

/** A quarter of trading. Long enough to survive a single panic day, short enough to still be "recent". */
export const FX_WINDOW_DAYS = 90

/** 'YYYY-MM-DD' → UTC midnight, or null. Parsed as UTC so the slope does not shift with the device timezone. */
function pointMs(point: FxPoint): number | null {
  const ms = Date.parse(`${point[0]}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

function usablePoint(point: FxPoint): boolean {
  return Number.isFinite(point[1]) && point[1] > 0
}

/** The newest close in the series, or null when there is none. Scans rather than trusting the sort order. */
export function fxLatest(series: FxPoint[]): FxPoint | null {
  let best: FxPoint | null = null
  let bestMs = -Infinity
  for (const point of series) {
    if (!usablePoint(point)) continue
    const ms = pointMs(point)
    if (ms === null || ms < bestMs) continue
    best = point
    bestMs = ms
  }
  return best
}

/** The rate from the newest close at or before `at` — what the shop actually paid on the day it bought. */
export function fxAt(series: FxPoint[], at: number): number | null {
  let best: number | null = null
  let bestMs = -Infinity
  for (const point of series) {
    if (!usablePoint(point)) continue
    const ms = pointMs(point)
    if (ms === null || ms > at || ms < bestMs) continue
    best = point[1]
    bestMs = ms
  }
  return best
}

/**
 * Monthly log slope of the last FX_WINDOW_DAYS, by ordinary least squares on ln(rate).
 * Null under 2 points in the window — one close is a level, not a trend.
 */
export function fxTrend(series: FxPoint[], now: number): number | null {
  const from = now - FX_WINDOW_DAYS * 86_400_000
  const ts: number[] = []
  const ys: number[] = []
  for (const point of series) {
    if (!usablePoint(point)) continue
    const ms = pointMs(point)
    // Points dated after `now` are not yet knowable, so the window is closed on both ends.
    if (ms === null || ms < from || ms > now) continue
    ts.push((ms - now) / MS_PER_MONTH)
    ys.push(Math.log(point[1]))
  }
  const n = ts.length
  if (n < 2) return null

  let tSum = 0
  let ySum = 0
  for (let i = 0; i < n; i += 1) {
    tSum += ts[i] ?? 0
    ySum += ys[i] ?? 0
  }
  const tBar = tSum / n
  const yBar = ySum / n

  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i += 1) {
    const dt = (ts[i] ?? 0) - tBar
    sxx += dt * dt
    sxy += dt * ((ys[i] ?? 0) - yBar)
  }
  // Every point on the same day: no spread in t, so the slope would be a division by zero.
  if (!(sxx > 0) || !Number.isFinite(sxx)) return null

  const slope = sxy / sxx
  return Number.isFinite(slope) ? slope : null
}
