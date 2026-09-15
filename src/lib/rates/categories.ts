/**
 * Merchant-friendly categories, each mapped to the CPI division the Statistical
 * Center of Iran publishes a monthly figure for. The ids are stored in IndexedDB
 * and in backup files, so they are never renamed once shipped.
 */
export const CATEGORY_IDS = [
  'food',
  'apparel',
  'home',
  'digital',
  'beauty',
  'health',
  'auto',
  'stationery',
  'other',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

/** 'other' has no division of its own — it falls back to the overall index. */
export const CATEGORY_CPI_DIVISION: Record<CategoryId, string | null> = {
  food: 'Food & non-alcoholic beverages',
  apparel: 'Clothing & footwear',
  home: 'Furnishings & household equipment',
  digital: 'Communication and recreation equipment',
  beauty: 'Personal care and miscellaneous goods',
  health: 'Health',
  auto: 'Transport',
  stationery: 'Recreation and education',
  other: null,
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value)
}

/** How much of a product's price is set abroad: 0 domestic, 1 fully dollar-linked. */
export const IMPORT_DEPENDENCIES = [0, 0.5, 1] as const
export type ImportDependency = (typeof IMPORT_DEPENDENCIES)[number]

export function isImportDependency(value: unknown): value is ImportDependency {
  return value === 0 || value === 0.5 || value === 1
}

/** i18n key for a category label, e.g. `categories.apparel`. */
export function categoryLabelKey(id: CategoryId): string {
  return `categories.${id}`
}
