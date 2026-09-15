/**
 * Works out which products are worth asking the shopkeeper about.
 *
 * This lives in its own module, away from the hook that calls it, so that none of it —
 * Dexie, the rate engine, the resolver — is reachable from the entry chunk. The hook holds
 * the state; this holds the work, and is imported only once the app is already running.
 */

import type { CheckInItem } from '../components/CheckInSheet'
import { db, type Product, type StoreProfile } from './db'
import { hasStoreProfile, observationsByProduct, readStoreProfile, staleProducts } from './observations'
import { productRate, type ProductRate } from './rates'
import { resolveRateSettings } from './rates/resolve'
import type { RatesFile } from './rates/schema'

export interface CheckInSnapshot {
  items: CheckInItem[]
  /** The instant every estimate here was pinned to. */
  now: number
  profile: StoreProfile
  /** false means setup has genuinely never been answered — `profile` is the neutral default. */
  hasProfile: boolean
  productCount: number
}

export async function computeCheckIn(rates: RatesFile): Promise<CheckInSnapshot> {
  const [products, byProduct, profile, answered] = await Promise.all([
    db.products.toArray(),
    observationsByProduct(),
    readStoreProfile(),
    hasStoreProfile(),
  ])

  /* One instant for the whole pass. Reading the clock per product would let a slow device
   * age the last product further than the first and quietly reorder the list. */
  const now = Date.now()

  /* Memoised per product: staleProducts asks for a rate by id, and the sheet needs the same
   * numbers again for its cards. Estimating twice would be slower and risk the two disagreeing. */
  const rateOf = new Map<number, ProductRate>()
  const productsById = new Map<number, Product>()
  for (const product of products) {
    productsById.set(product.id, product)
    const settings = resolveRateSettings(product, profile)
    rateOf.set(
      product.id,
      productRate({
        observations: byProduct.get(product.id) ?? [],
        category: settings.category,
        importDependency: settings.importDependency,
        ...(settings.manualMonthlyPercent === undefined ? {} : { manualMonthlyPercent: settings.manualMonthlyPercent }),
        rates,
        now,
      }),
    )
  }

  const items: CheckInItem[] = []
  for (const candidate of staleProducts(products, byProduct, (id) => rateOf.get(id) ?? null, now)) {
    const product = productsById.get(candidate.productId)
    if (product === undefined) continue
    items.push({
      product,
      predictedCost: candidate.predictedCost,
      // Unfiltered on purpose: the sheet's outlier check needs the excluded rows too.
      history: byProduct.get(product.id) ?? [],
    })
  }

  return { items, now, profile, hasProfile: answered, productCount: products.length }
}
