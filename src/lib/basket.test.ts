import { describe, expect, it } from 'vitest'
import { computeBasketTotals, type BasketLine } from './basket'

const line = (partial: Partial<BasketLine> & Pick<BasketLine, 'mode' | 'inputs' | 'results'>): BasketLine => partial

describe('computeBasketTotals', () => {
  it('sums seller items (profit + sell) with overall margin', () => {
    const totals = computeBasketTotals([
      line({ mode: 'profit', inputs: [100, 25], results: [125, 25] }),
      line({ mode: 'sell', inputs: [200, 260], results: [30, 60] }),
    ])
    expect(totals).toHaveLength(1)
    const g = totals[0]!
    expect(g.sellerCount).toBe(2)
    expect(g.cost).toBe(300)
    expect(g.revenue).toBe(385)
    expect(g.profit).toBe(85)
    expect(g.marginPercent).toBe(28.33)
  })

  it('handles losses in the total', () => {
    const totals = computeBasketTotals([
      line({ mode: 'sell', inputs: [200, 150], results: [-25, -50] }),
      line({ mode: 'profit', inputs: [100, 20], results: [120, 20] }),
    ])
    expect(totals[0]!.profit).toBe(-30)
    expect(totals[0]!.marginPercent).toBe(-10)
  })

  it('sums shopper items (discount + reverse discount)', () => {
    const totals = computeBasketTotals([
      line({ mode: 'discount', inputs: [200, 15], results: [170, 30] }),
      line({ mode: 'rdiscount', inputs: [85, 15], results: [100, 15] }),
    ])
    const g = totals[0]!
    expect(g.shopperCount).toBe(2)
    expect(g.original).toBe(300)
    expect(g.pay).toBe(255)
    expect(g.saved).toBe(45)
    expect(g.marginPercent).toBeNull()
  })

  it('groups by currency unit, preserving insertion order', () => {
    const totals = computeBasketTotals([
      line({ mode: 'profit', inputs: [100, 10], results: [110, 10], unit: 'toman' }),
      line({ mode: 'profit', inputs: [50, 10], results: [55, 5], unit: 'usd' }),
      line({ mode: 'profit', inputs: [200, 10], results: [220, 20], unit: 'toman' }),
    ])
    expect(totals.map((t) => t.unit)).toEqual(['toman', 'usd'])
    expect(totals[0]!.cost).toBe(300)
    expect(totals[1]!.cost).toBe(50)
  })

  it('mixes seller and shopper items in one group', () => {
    const totals = computeBasketTotals([
      line({ mode: 'profit', inputs: [100, 25], results: [125, 25] }),
      line({ mode: 'discount', inputs: [80, 50], results: [40, 40] }),
    ])
    const g = totals[0]!
    expect(g.sellerCount).toBe(1)
    expect(g.shopperCount).toBe(1)
    expect(g.profit).toBe(25)
    expect(g.saved).toBe(40)
  })

  it('returns empty for an empty basket', () => {
    expect(computeBasketTotals([])).toEqual([])
  })
})
