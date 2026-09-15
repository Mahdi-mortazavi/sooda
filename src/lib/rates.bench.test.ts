/**
 * The products screen calls `productRate` once per row, on every render, with the whole history in
 * memory. A shopkeeper with a thousand lines on a cheap Android phone is the case that has to stay
 * fast, so the budget is asserted rather than eyeballed: a regression fails CI instead of quietly
 * making the list janky. Node is much faster than that phone, hence the strict ceiling.
 */

import { describe, expect, it } from 'vitest'
import type { Observation } from './db'
import { productRate, type ProductRate } from './rates'
import { CATEGORY_IDS, type CategoryId, type ImportDependency } from './rates/categories'
import type { FxPoint, RatesFile } from './rates/schema'

const PRODUCT_COUNT = 1000
const OBSERVATIONS_EACH = 20
const BUDGET_MS = 150

const NOW = Date.UTC(2026, 8, 15)
const DAY = 86_400_000

/* A cheap deterministic generator: `Math.random()` would make a failure impossible to reproduce. */
function noise(seed: number): number {
  const x = Math.sin(seed) * 10_000
  return x - Math.floor(x)
}

/*
 * 90 daily closes — `FX_WINDOW_DAYS` exactly, so every point in the fixture is one the trend
 * actually reads. Not tuned to make the budget: the pipeline in scripts/rates/config.json fetches
 * 30 days, so this is already three times the series the app will really be handed.
 *
 * It matters because the FX leg, not the price history, is what this pass spends its time on:
 * `fxTrend` and `fxAt` re-parse every date string in the series once per PRODUCT, though both
 * depend only on the series and `now`. At 90 points that is ~75ms of the measurement; the personal
 * fit over all 20,000 observations is ~16ms. Hoisting the FX work out of the per-product loop (or
 * memoising the parsed timestamps) would take this pass to roughly a quarter of its cost.
 */
function buildFxSeries(points: number): FxPoint[] {
  const out: FxPoint[] = []
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(NOW - i * DAY).toISOString().slice(0, 10)
    out.push([date, 90_000 + Math.round(noise(i) * 4_000)])
  }
  return out
}

const rates: RatesFile = {
  schema: 1,
  updatedAt: '2026-09-14',
  cpi: {
    source: { name: 'SCI', url: 'https://example.invalid/cpi' },
    asOf: '2026-08',
    confidence: null,
    overallMonthlyPercent: 2.4,
    categories: { food: 3.1, apparel: 2.2, home: 1.9, digital: 4.4, beauty: 2.7, health: 1.6, auto: 3.8 },
  },
  fx: { source: { name: 'FX', url: 'https://example.invalid/fx' }, pair: 'USD/IRR', series: buildFxSeries(90) },
}

interface Row {
  productId: number
  category: CategoryId
  importDependency: ImportDependency
}

/* Fixture generation is deliberately OUTSIDE the timed region: building 20,000 objects is a cost
 * the real app never pays, and including it would hide the thing being measured. */
const rows: Row[] = []
const allObservations: Observation[] = []
const dependencies: ImportDependency[] = [0, 0.5, 1]
let observationId = 0

for (let p = 1; p <= PRODUCT_COUNT; p++) {
  rows.push({
    productId: p,
    category: CATEGORY_IDS[p % CATEGORY_IDS.length]!,
    importDependency: dependencies[p % dependencies.length]!,
  })
  let cost = 50_000 + Math.round(noise(p) * 200_000)
  for (let i = OBSERVATIONS_EACH; i >= 1; i--) {
    // Roughly monthly readings walking back two years, drifting upward with a little noise.
    cost = Math.round(cost * (1 + (noise(p * 31 + i) * 0.06 - 0.01)))
    allObservations.push({
      id: ++observationId,
      productId: p,
      cost,
      observedAt: NOW - i * 30 * DAY,
      fxAtDate: 90_000 + Math.round(noise(p + i) * 4_000),
      // One reading in twenty is a sale price the user disowned, as in a real list.
      ...(i === 7 ? { excluded: true } : {}),
      source: 'update',
    })
  }
}

describe('productRate over a thousand-product price list', () => {
  /** One full pass: group the flat table, then rate every product. Returns the elapsed ms. */
  function measureOnce(): { elapsed: number; results: ProductRate[]; groups: number } {
    const started = performance.now()

    const byProduct = new Map<number, Observation[]>()
    for (const o of allObservations) {
      const bucket = byProduct.get(o.productId)
      if (bucket === undefined) byProduct.set(o.productId, [o])
      else bucket.push(o)
    }

    const results: ProductRate[] = []
    for (const row of rows) {
      results.push(
        productRate({
          observations: byProduct.get(row.productId) ?? [],
          category: row.category,
          importDependency: row.importDependency,
          rates,
          now: NOW,
        }),
      )
    }

    return { elapsed: performance.now() - started, results, groups: byProduct.size }
  }

  it(`groups ${allObservations.length} observations and rates ${PRODUCT_COUNT} products under ${BUDGET_MS}ms`, () => {
    expect(allObservations).toHaveLength(PRODUCT_COUNT * OBSERVATIONS_EACH)

    /* Three passes, judged on the median. A single sample on a CI box shared with other jobs
     * measures the scheduler as much as the code, and the first pass always pays for JIT warm-up;
     * the median throws both away without softening what counts as a regression. */
    const samples: number[] = []
    let last = measureOnce()
    for (let i = 0; i < 3; i += 1) {
      last = measureOnce()
      samples.push(last.elapsed)
    }
    const median = [...samples].sort((a, b) => a - b)[1]!

    // Printed so a regression is visible in CI output even on the run that still passes.
    console.log(
      `[bench] ${PRODUCT_COUNT} products × ${OBSERVATIONS_EACH} observations: median ${median.toFixed(1)}ms ` +
        `of [${samples.map((s) => s.toFixed(1)).join(', ')}] (budget ${BUDGET_MS}ms)`,
    )

    expect(last.groups).toBe(PRODUCT_COUNT)
    expect(last.results).toHaveLength(PRODUCT_COUNT)
    // A pass that produced nothing usable would be fast and worthless.
    expect(last.results.every((r) => Number.isFinite(r.monthlyPercent))).toBe(true)
    expect(last.results.every((r) => r.replacementNow !== null && Number.isFinite(r.replacementNow))).toBe(true)
    expect(median).toBeLessThan(BUDGET_MS)
  })
})
