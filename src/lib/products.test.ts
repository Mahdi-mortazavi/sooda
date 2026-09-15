import { describe, expect, it } from 'vitest'
import type { Product } from './db'
import { annualToMonthlyPercent } from './inflation'
import type { RoundingStep } from './rounding'
import {
  buildProductsCsv,
  previewBulk,
  productStatus,
  searchProducts,
  sortProducts,
  type BulkOp,
  type ProductStatus,
} from './products'

const MARCH = Date.UTC(2026, 2, 15)
const SEPTEMBER = Date.UTC(2026, 8, 15)

const product = (partial: Partial<Product> & Pick<Product, 'id' | 'name'>): Product => ({
  cost: 100_000,
  targetMarginPercent: 30,
  price: 130_000,
  costUpdatedAt: SEPTEMBER,
  createdAt: SEPTEMBER,
  updatedAt: SEPTEMBER,
  ...partial,
})

describe('productStatus', () => {
  it('leaves a cost recorded today untouched', () => {
    const s = productStatus(product({ id: 1, name: 'Fresh' }), 40, SEPTEMBER)
    expect(s.costAgeMonths).toBe(0)
    expect(s.replacement).toBe(100_000)
    expect(s.realMarginPercent).toBe(30)
    expect(s.health).toBe('healthy')
  })

  it('ages a six-month-old cost by compounded monthly inflation', () => {
    // The scenario is still 40% a YEAR; since v1.5 productStatus takes a monthly percent.
    const s = productStatus(
      product({ id: 1, name: 'Stale', costUpdatedAt: MARCH }),
      annualToMonthlyPercent(40),
      SEPTEMBER,
    )
    expect(s.costAgeMonths).toBe(6)
    // 100000 · 1.4^(6/12) — half a year of 40%/yr, compounded monthly.
    expect(s.replacement).toBe(118_321.6)
    expect(s.realMarginPercent).toBe(9.87)
    expect(s.health).toBe('thin')
  })

  it('calls a margin at or above 80% of target healthy', () => {
    const s = productStatus(product({ id: 1, name: 'Edge', targetMarginPercent: 25, price: 120_000 }), 0, SEPTEMBER)
    expect(s.realMarginPercent).toBe(20)
    expect(s.health).toBe('healthy')
  })

  it('calls a positive margin below 80% of target thin', () => {
    const s = productStatus(product({ id: 1, name: 'Thin', targetMarginPercent: 30, price: 120_000 }), 0, SEPTEMBER)
    expect(s.realMarginPercent).toBe(20)
    expect(s.health).toBe('thin')
  })

  it('calls a zero or negative margin losing', () => {
    const flat = productStatus(product({ id: 1, name: 'Flat', price: 100_000 }), 0, SEPTEMBER)
    expect(flat.realMarginPercent).toBe(0)
    expect(flat.health).toBe('losing')
    const under = productStatus(product({ id: 2, name: 'Under', price: 90_000 }), 0, SEPTEMBER)
    expect(under.realMarginPercent).toBe(-10)
    expect(under.health).toBe('losing')
  })

  it('treats any profit as healthy when the target margin is zero', () => {
    const s = productStatus(product({ id: 1, name: 'No target', targetMarginPercent: 0, price: 110_000 }), 0, SEPTEMBER)
    expect(s.realMarginPercent).toBe(10)
    expect(s.health).toBe('healthy')
  })
})

describe('sortProducts', () => {
  const a = product({ id: 1, name: 'Banana', updatedAt: 3000 })
  const b = product({ id: 2, name: 'apple', updatedAt: 1000 })
  const c = product({ id: 3, name: 'Cherry', updatedAt: 2000 })
  const items = [a, b, c]

  const statuses = new Map<number, ProductStatus>([
    [1, { replacement: 1, realMarginPercent: 12, health: 'thin', costAgeMonths: 0 }],
    [2, { replacement: 1, realMarginPercent: -5, health: 'losing', costAgeMonths: 0 }],
    [3, { replacement: 1, realMarginPercent: 40, health: 'healthy', costAgeMonths: 0 }],
  ])

  it('puts the worst real margin first for risk', () => {
    expect(sortProducts(items, 'risk', statuses).map((p) => p.id)).toEqual([2, 1, 3])
  })

  it('sinks products with no computed status to the bottom instead of flagging them as risky', () => {
    expect(sortProducts(items, 'risk', new Map([[3, statuses.get(3)!]])).map((p) => p.id)).toEqual([3, 1, 2])
  })

  it('sorts by name case-insensitively', () => {
    expect(sortProducts(items, 'name', statuses).map((p) => p.name)).toEqual(['apple', 'Banana', 'Cherry'])
  })

  it('sorts Persian names by the Persian alphabet', () => {
    const fa = [
      product({ id: 4, name: 'کاغذ' }),
      product({ id: 5, name: 'برنج' }),
      product({ id: 6, name: 'آب' }),
    ]
    expect(sortProducts(fa, 'name', statuses).map((p) => p.name)).toEqual(['آب', 'برنج', 'کاغذ'])
  })

  it('puts the most recently updated first', () => {
    expect(sortProducts(items, 'updated', statuses).map((p) => p.id)).toEqual([1, 3, 2])
  })

  it('is stable for equal keys and never mutates the input', () => {
    const tied = [product({ id: 7, name: 'x', updatedAt: 500 }), product({ id: 8, name: 'x', updatedAt: 500 })]
    expect(sortProducts(tied, 'updated', statuses).map((p) => p.id)).toEqual([7, 8])
    expect(sortProducts(tied, 'name', statuses).map((p) => p.id)).toEqual([7, 8])
    const before = items.map((p) => p.id)
    sortProducts(items, 'name', statuses)
    expect(items.map((p) => p.id)).toEqual(before)
  })
})

describe('searchProducts', () => {
  const items = [
    product({ id: 1, name: 'Green Tea' }),
    product({ id: 2, name: 'مداد ۲' }),
    product({ id: 3, name: 'دفتر ۱۰۰ برگ' }),
  ]

  it('returns everything for an empty or blank query', () => {
    expect(searchProducts(items, '')).toEqual(items)
    expect(searchProducts(items, '   ')).toEqual(items)
  })

  it('matches Latin names case-insensitively', () => {
    expect(searchProducts(items, 'tea').map((p) => p.id)).toEqual([1])
    expect(searchProducts(items, 'GREEN').map((p) => p.id)).toEqual([1])
  })

  it('matches Persian names', () => {
    expect(searchProducts(items, 'مداد').map((p) => p.id)).toEqual([2])
  })

  it('matches Persian digits typed either way round', () => {
    expect(searchProducts(items, '100').map((p) => p.id)).toEqual([3])
    expect(searchProducts(items, '۱۰۰').map((p) => p.id)).toEqual([3])
  })

  it('returns nothing when there is no match', () => {
    expect(searchProducts(items, 'zzz')).toEqual([])
  })
})

describe('previewBulk', () => {
  /* A cost stamped today, so 'retarget' has no inflation to age it by and the two
   * operations can be compared against plain arithmetic. */
  const NOW = Date.UTC(2026, 8, 15)
  const items = [
    product({ id: 1, name: 'A', cost: 100_000, targetMarginPercent: 30, price: 120_000, costUpdatedAt: NOW }),
  ]
  const preview = (op: BulkOp, step: RoundingStep = 0, inflation = 40, now = NOW) =>
    previewBulk(items, op, step, inflation, now)

  it('raises cost then reprices to the target margin', () => {
    expect(preview({ kind: 'costUp', percent: 15 })).toEqual([
      { id: 1, name: 'A', oldPrice: 120_000, newPrice: 149_500, oldCost: 100_000, newCost: 115_000 },
    ])
  })

  it('rounds the new price up to the chosen step', () => {
    expect(preview({ kind: 'costUp', percent: 15 }, 5000)[0]!.newPrice).toBe(150_000)
    expect(preview({ kind: 'costUp', percent: 15 }, 50_000)[0]!.newPrice).toBe(150_000)
  })

  it('retargets a fresh cost without touching it', () => {
    expect(preview({ kind: 'retarget' })).toEqual([
      { id: 1, name: 'A', oldPrice: 120_000, newPrice: 130_000, oldCost: 100_000, newCost: 100_000 },
    ])
  })

  it('retargets against the replacement cost, so the row is not instantly losing again', () => {
    const stale = [
      product({
        id: 3,
        name: 'C',
        cost: 100_000,
        targetMarginPercent: 20,
        price: 120_000,
        costUpdatedAt: Date.UTC(2025, 8, 15),
      }),
    ]
    const [row] = previewBulk(stale, { kind: 'retarget' }, 0, 40, NOW)
    const status = productStatus({ ...stale[0]!, price: row!.newPrice }, 40, NOW)
    // The whole point: after repricing, the products list must call the row healthy.
    expect(status.health).toBe('healthy')
    expect(status.realMarginPercent).toBeCloseTo(20, 1)
    // The purchase price the user actually paid is left alone.
    expect(row!.newCost).toBe(100_000)
  })

  it('refuses to invert a cost, whatever the user types', () => {
    const [row] = preview({ kind: 'costUp', percent: -200 })
    expect(row!.newCost).toBe(0)
    expect(row!.newPrice).toBe(0)
  })

  it('still returns rows that would not change, so the caller decides what to hide', () => {
    const settled = [
      product({ id: 2, name: 'B', cost: 100_000, targetMarginPercent: 30, price: 130_000, costUpdatedAt: NOW }),
    ]
    expect(previewBulk(settled, { kind: 'retarget' }, 0, 40, NOW)).toEqual([
      { id: 2, name: 'B', oldPrice: 130_000, newPrice: 130_000, oldCost: 100_000, newCost: 100_000 },
    ])
  })

  it('returns nothing for an empty selection', () => {
    expect(previewBulk([], { kind: 'costUp', percent: 15 }, 1000, 40, NOW)).toEqual([])
  })
})

describe('buildProductsCsv', () => {
  const headers = ['name', 'cost', 'target', 'price', 'unit', 'note', 'costUpdatedAt', 'updatedAt']

  it('starts with a UTF-8 BOM and the header row', () => {
    const csv = buildProductsCsv([], headers)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿' + headers.join(','))
  })

  it('writes one row per product with ISO timestamps and blanks for absent fields', () => {
    const csv = buildProductsCsv(
      [
        product({
          id: 1,
          name: 'Tea',
          cost: 100_000,
          targetMarginPercent: 30,
          price: 130_000,
          unit: 'toman',
          note: 'top shelf',
          costUpdatedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
          updatedAt: Date.UTC(2026, 0, 3, 3, 4, 5),
        }),
        product({ id: 2, name: 'Plain', unit: 'none' }),
      ],
      headers,
    )
    const rows = csv.split('\n')
    expect(rows[1]).toBe('Tea,100000,30,130000,toman,top shelf,2026-01-02T03:04:05.000Z,2026-01-03T03:04:05.000Z')
    expect(rows[2]).toBe('Plain,100000,30,130000,,,2026-09-15T00:00:00.000Z,2026-09-15T00:00:00.000Z')
  })

  it('quotes and escapes a name containing a comma, a quote and a newline', () => {
    const csv = buildProductsCsv([product({ id: 1, name: 'Tea "A", B\nC' })], headers)
    expect(csv.split('﻿')[1]!.startsWith(headers.join(','))).toBe(true)
    expect(csv).toContain('"Tea ""A"", B\nC"')
  })
})

describe('productStatus guards', () => {
  const NOW = Date.UTC(2026, 8, 15)

  it('refuses to judge a product with no recorded purchase price', () => {
    const status = productStatus(
      product({ id: 9, name: 'Z', cost: 0, price: 130_000, targetMarginPercent: 20, costUpdatedAt: NOW }),
      40,
      NOW,
    )
    expect(Number.isFinite(status.realMarginPercent)).toBe(true)
    expect(status.realMarginPercent).toBe(0)
    expect(status.health).toBe('losing')
  })

  it('never produces NaN when both the cost and the price are zero', () => {
    const status = productStatus(
      product({ id: 10, name: 'Y', cost: 0, price: 0, targetMarginPercent: 0, costUpdatedAt: NOW }),
      40,
      NOW,
    )
    expect(Number.isNaN(status.realMarginPercent)).toBe(false)
    expect(status.health).toBe('losing')
  })
})

/* v1.4 widened `Product` with three optional fields. Every pure helper on this module predates them
 * and must keep behaving as though they were not there — the products screen still renders v1.3
 * rows and v1.4 rows side by side. */
describe('v1.4’s optional product fields', () => {
  const plain = product({ id: 1, name: 'Tea', costUpdatedAt: MARCH })
  const tagged: Product = { ...plain, category: 'food', importDependency: 1, manualMonthlyPercent: 4 }

  it('does not change what productStatus computes', () => {
    expect(productStatus(tagged, 40, SEPTEMBER)).toEqual(productStatus(plain, 40, SEPTEMBER))
  })

  it('does not change what previewBulk proposes', () => {
    const op: BulkOp = { kind: 'costUp', percent: 12 }
    const step: RoundingStep = 1000
    expect(previewBulk([tagged], op, step, 40, SEPTEMBER)).toEqual(previewBulk([plain], op, step, 40, SEPTEMBER))
  })

  it('does not add columns to the CSV export', () => {
    const headers = ['name', 'cost', 'margin', 'price', 'unit', 'note', 'costUpdatedAt', 'updatedAt']
    expect(buildProductsCsv([tagged], headers)).toBe(buildProductsCsv([plain], headers))
  })

  it('leaves searching and sorting alone', () => {
    expect(searchProducts([tagged], 'tea')).toEqual([tagged])
    const statuses = new Map<number, ProductStatus>()
    expect(sortProducts([tagged], 'name', statuses)).toEqual([tagged])
  })
})
