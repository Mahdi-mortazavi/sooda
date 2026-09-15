/**
 * Which settings a given product's estimate should actually use.
 *
 * A product carries its own category and import dependency only when the shopkeeper set
 * them; v1.3 rows have neither, and most v1.4 rows never will. The store profile is the
 * fallback for both, which is the whole reason it is worth asking for: answer two
 * questions once and every product in the shop gets a better prior.
 */

import type { Product, StoreProfile } from '../db'
import type { CategoryId, ImportDependency } from './categories'

/** Used when there is no profile either — a neutral category at half dollar exposure. */
export const FALLBACK_CATEGORY: CategoryId = 'other'
export const FALLBACK_IMPORT_DEPENDENCY: ImportDependency = 0.5

export interface ResolvedRateSettings {
  category: CategoryId
  importDependency: ImportDependency
  /** Present only when something actually overrides the estimate. */
  manualMonthlyPercent?: number
}

/**
 * Most specific wins: the product's own setting, then the store profile, then the neutral
 * default. The profile's category list is ordered, and its first entry is the primary one
 * new products inherit.
 */
export function resolveRateSettings(
  product: Pick<Product, 'category' | 'importDependency' | 'manualMonthlyPercent'>,
  profile: StoreProfile | null,
): ResolvedRateSettings {
  const category = product.category ?? profile?.categories[0] ?? FALLBACK_CATEGORY
  const importDependency = product.importDependency ?? profile?.importDependency ?? FALLBACK_IMPORT_DEPENDENCY

  /* A store-wide manual rate is a last resort, not a peer of the per-product one: the
   * profile's own comment calls it a fallback for a rates file with no figures at all. */
  const manual = product.manualMonthlyPercent ?? profile?.manualMonthlyPercent
  return manual === undefined ? { category, importDependency } : { category, importDependency, manualMonthlyPercent: manual }
}
