import { describe, expect, it } from 'vitest'
import { FX_WINDOW_DAYS, fxAt, fxLatest, fxTrend } from './fx'
import { MS_PER_MONTH } from './estimate'
import type { FxPoint } from './schema'

const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`)
const NOW = day('2026-09-15')

/** A geometric series: `daily` compounding per day, oldest first, ending on 2026-09-15. */
function ramp(days: number, start: number, daily: number): FxPoint[] {
  const series: FxPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(NOW - i * 86_400_000).toISOString().slice(0, 10)
    series.push([date, start * Math.pow(1 + daily, days - 1 - i)])
  }
  return series
}

describe('FX_WINDOW_DAYS', () => {
  it('is a quarter of trading', () => {
    expect(FX_WINDOW_DAYS).toBe(90)
  })
})

describe('fxLatest', () => {
  it('returns the newest close', () => {
    expect(fxLatest([['2026-09-01', 100_000], ['2026-09-02', 101_000]])).toEqual(['2026-09-02', 101_000])
  })

  it('does not trust the sort order blindly', () => {
    expect(fxLatest([['2026-09-05', 105_000], ['2026-09-02', 101_000]])).toEqual(['2026-09-05', 105_000])
  })

  it('is null for an empty series', () => {
    expect(fxLatest([])).toBeNull()
  })
})

describe('fxAt', () => {
  const series: FxPoint[] = [
    ['2026-09-01', 100_000],
    ['2026-09-05', 105_000],
    ['2026-09-10', 110_000],
  ]

  it('takes the newest close at or before the instant asked for', () => {
    expect(fxAt(series, day('2026-09-07'))).toBe(105_000)
    expect(fxAt(series, day('2026-09-05'))).toBe(105_000)
    expect(fxAt(series, day('2026-09-05') - 1)).toBe(100_000)
  })

  it('is null before the series starts and the last close after it ends', () => {
    expect(fxAt(series, day('2026-08-31'))).toBeNull()
    expect(fxAt(series, day('2026-12-31'))).toBe(110_000)
  })

  it('is null for an empty series', () => {
    expect(fxAt([], NOW)).toBeNull()
  })
})

describe('fxTrend', () => {
  it('turns a steady daily climb into the matching monthly log slope', () => {
    const daily = 0.002
    const trend = fxTrend(ramp(60, 100_000, daily), NOW)
    expect(trend).not.toBeNull()
    if (trend === null) return
    expect(trend).toBeCloseTo(Math.log1p(daily) * (MS_PER_MONTH / 86_400_000), 9)
  })

  it('is flat for a flat series', () => {
    const trend = fxTrend(ramp(30, 100_000, 0), NOW)
    expect(trend).toBeCloseTo(0, 12)
  })

  it('goes negative when the rate falls', () => {
    const trend = fxTrend(ramp(30, 100_000, -0.001), NOW)
    expect(trend).not.toBeNull()
    if (trend === null) return
    expect(trend).toBeLessThan(0)
  })

  it('is null under two points in the window', () => {
    expect(fxTrend([], NOW)).toBeNull()
    expect(fxTrend([['2026-09-14', 100_000]], NOW)).toBeNull()
    // Both points predate the 90-day window, so the window itself is empty.
    expect(fxTrend([['2025-01-01', 100_000], ['2025-02-01', 120_000]], NOW)).toBeNull()
  })

  it('ignores points older than the window', () => {
    const recent: FxPoint[] = [['2026-09-01', 100_000], ['2026-09-15', 110_000]]
    const withAncient: FxPoint[] = [['2020-01-01', 1_000], ...recent]
    expect(fxTrend(withAncient, NOW)).toBe(fxTrend(recent, NOW))
  })

  it('ignores points dated after now, which are not yet knowable', () => {
    const series: FxPoint[] = [['2026-09-01', 100_000], ['2026-09-15', 110_000], ['2026-09-20', 400_000]]
    expect(fxTrend(series, NOW)).toBe(fxTrend([['2026-09-01', 100_000], ['2026-09-15', 110_000]], NOW))
  })

  it('reproduces a two-point slope exactly', () => {
    const series: FxPoint[] = [['2026-08-16', 100_000], ['2026-09-15', 120_000]]
    const months = 30 * 86_400_000 / MS_PER_MONTH
    expect(fxTrend(series, NOW)).toBeCloseTo(Math.log(1.2) / months, 12)
  })

  it('is null when every point lands on the same day', () => {
    expect(fxTrend([['2026-09-10', 100_000], ['2026-09-10', 200_000]], NOW)).toBeNull()
  })

  it('never returns NaN for malformed points', () => {
    const series = [['2026-09-01', Number.NaN], ['not-a-date', 100_000], ['2026-09-15', 110_000]] as FxPoint[]
    expect(fxTrend(series, NOW)).toBeNull()
    expect(fxLatest(series)).toEqual(['2026-09-15', 110_000])
    expect(fxAt(series, NOW)).toBe(110_000)
  })
})
