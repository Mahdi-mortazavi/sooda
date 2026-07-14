import { round2, type Mode } from './calc'
import type { Unit } from './units'

/** Minimal shape needed to total a basket line (matches BasketItem). */
export interface BasketLine {
  mode: Mode
  inputs: [number, number]
  results: [number, number]
  unit?: Unit
}

/** Seller-side (profit/sell) and shopper-side (discount) sums for one currency unit. */
export interface BasketTotals {
  unit: Unit
  /** profit & sell-price items */
  sellerCount: number
  cost: number
  revenue: number
  profit: number
  /** overall margin in %, null when there is no cost */
  marginPercent: number | null
  /** discount & reverse-discount items */
  shopperCount: number
  original: number
  pay: number
  saved: number
}

function emptyTotals(unit: Unit): BasketTotals {
  return {
    unit,
    sellerCount: 0,
    cost: 0,
    revenue: 0,
    profit: 0,
    marginPercent: null,
    shopperCount: 0,
    original: 0,
    pay: 0,
    saved: 0,
  }
}

/**
 * Sum basket lines, grouped by currency unit (insertion order preserved).
 * - profit:    cost = purchase, revenue = selling price, profit = amount
 * - sell:      cost = purchase, revenue = selling price, profit = amount (may be negative)
 * - discount:  original = list price, pay = final price, saved = amount
 * - rdiscount: original = recovered price, pay = final price, saved = amount
 */
export function computeBasketTotals(lines: BasketLine[]): BasketTotals[] {
  const groups = new Map<Unit, BasketTotals>()
  for (const line of lines) {
    const unit = line.unit ?? 'none'
    let g = groups.get(unit)
    if (!g) {
      g = emptyTotals(unit)
      groups.set(unit, g)
    }
    switch (line.mode) {
      case 'profit':
        g.sellerCount++
        g.cost += line.inputs[0]
        g.revenue += line.results[0]
        g.profit += line.results[1]
        break
      case 'sell':
        g.sellerCount++
        g.cost += line.inputs[0]
        g.revenue += line.inputs[1]
        g.profit += line.results[1]
        break
      case 'discount':
        g.shopperCount++
        g.original += line.inputs[0]
        g.pay += line.results[0]
        g.saved += line.results[1]
        break
      case 'rdiscount':
        g.shopperCount++
        g.original += line.results[0]
        g.pay += line.inputs[0]
        g.saved += line.results[1]
        break
    }
  }
  const out: BasketTotals[] = []
  for (const g of groups.values()) {
    g.cost = round2(g.cost)
    g.revenue = round2(g.revenue)
    g.profit = round2(g.profit)
    g.original = round2(g.original)
    g.pay = round2(g.pay)
    g.saved = round2(g.saved)
    g.marginPercent = g.sellerCount > 0 && g.cost > 0 ? round2((g.profit / g.cost) * 100) : null
    out.push(g)
  }
  return out
}
