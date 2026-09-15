/**
 * The demo shop every lesson practises on: five things an Iranian corner shop really stocks, each
 * with the purchase prices a shopkeeper would have recorded over the past few months.
 *
 * Deterministic on purpose. Every timestamp is a fixed offset from the `now` handed in and every
 * cost is a literal, so a lesson's challenge answer is the same figure today and next Ordibehesht.
 * Change a number here and `scripts/lesson-examples.mjs` will disagree with the lesson files.
 *
 * Names are the exception, and deliberately so: they go through i18n, because an English-locale
 * learner reading English lesson text must not be looking at five Persian rows. A name is not a
 * figure — translating one cannot move an answer — so the seed stays reproducible either way.
 */

import type { Observation, ObservationSource, Product, StoreProfile } from '../../lib/db'
import type { CategoryId } from '../../lib/rates/categories'
import { MS_PER_MONTH } from '../../lib/rates'
import { roundUpTo, type RoundingStep } from '../../lib/rounding'
import type { PracticeDb } from './db'

/** Stable handles for lesson authors: `SEED_PRODUCTS.rice` is product 1 in every practice run. */
export const SEED_PRODUCTS = {
  rice: 1,
  oil: 2,
  shampoo: 3,
  notebook: 4,
  battery: 5,
} as const

/**
 * How a name reaches the shop. The UI passes i18next's own `t`:
 * `(key, fallback) => t(key, { defaultValue: fallback })`.
 *
 * The default returns the Persian fallback, so `buildSeed(now)` on its own — in a test, or in
 * `scripts/lesson-examples.mjs` — is still a pure function of `now`.
 */
export type SeedTranslate = (key: string, fallback: string) => string

const PERSIAN: SeedTranslate = (_key, fallback) => fallback

/** Every key the demo shop needs, in one place, so `copy` can see the whole list at a glance. */
export const SEED_TEXT_KEYS = [
  'learn.sandbox.products.rice',
  'learn.sandbox.products.oil',
  'learn.sandbox.products.shampoo',
  'learn.sandbox.products.notebook',
  'learn.sandbox.products.battery',
  'learn.sandbox.notes.stalePrice',
] as const

/** The step the demo shop prices on — 1,000 toman, the default a corner shop would pick. */
const SEED_ROUNDING: RoundingStep = 1000

interface SeedReading {
  /** How long before `now` this price was paid. */
  monthsAgo: number
  cost: number
  source: ObservationSource
  /** A sale price the shopkeeper disowned: stored, shown, and ignored by the estimator. */
  excluded?: boolean
}

interface SeedSpec {
  id: number
  /** The i18n key the name is looked up under; `name` is the Persian text and the fallback. */
  nameKey: string
  name: string
  category: CategoryId
  targetMarginPercent: number
  /**
   * Which reading the shelf price was built on. 'first' leaves the product visibly under-priced —
   * the lesson about profit not surviving a restock needs something that is actually losing money.
   */
  pricedOn: 'first' | 'last'
  noteKey?: string
  note?: string
  readings: SeedReading[]
}

/* Costs are literals rather than a compounded series: a lesson quotes these figures in its own
 * text, and a rounding change in some shared helper must never quietly reword a lesson. */
const SEED: SeedSpec[] = [
  {
    id: SEED_PRODUCTS.rice,
    nameKey: 'learn.sandbox.products.rice',
    name: 'برنج هاشمی درجه یک ۱۰ کیلویی',
    category: 'food',
    /* Staples run thin — 8–15%, not the 18% an earlier draft had. The margin is not decoration:
     * the realProfit lesson teaches that a thin margin is where profit disappears first, and it
     * has to teach it on a product whose margin is genuinely thin. */
    targetMarginPercent: 12,
    pricedOn: 'first',
    noteKey: 'learn.sandbox.notes.stalePrice',
    note: 'قیمت فروش روی خرید قبلی مانده',
    readings: [
      { monthsAgo: 5, cost: 2_150_000, source: 'save' },
      { monthsAgo: 3, cost: 2_300_000, source: 'update' },
      { monthsAgo: 1, cost: 2_480_000, source: 'update' },
    ],
  },
  {
    id: SEED_PRODUCTS.oil,
    nameKey: 'learn.sandbox.products.oil',
    // «روغن» alone reads as روغن جامد, or as motor oil.
    name: 'روغن مایع آفتابگردان ۱.۸ لیتری',
    category: 'food',
    // Price-regulated: the margin a shopkeeper actually gets on it is single digits.
    targetMarginPercent: 8,
    pricedOn: 'last',
    readings: [
      { monthsAgo: 4, cost: 98_000, source: 'save' },
      { monthsAgo: 2, cost: 108_000, source: 'update' },
      { monthsAgo: 1, cost: 118_000, source: 'checkin' },
    ],
  },
  {
    id: SEED_PRODUCTS.shampoo,
    nameKey: 'learn.sandbox.products.shampoo',
    name: 'شامپو ضدشوره ۴۰۰ میلی‌لیتری',
    category: 'beauty',
    targetMarginPercent: 35,
    pricedOn: 'last',
    readings: [
      { monthsAgo: 6, cost: 210_000, source: 'save' },
      { monthsAgo: 4, cost: 168_000, source: 'update', excluded: true },
      { monthsAgo: 3, cost: 225_000, source: 'update' },
      { monthsAgo: 1, cost: 238_000, source: 'update' },
    ],
  },
  {
    id: SEED_PRODUCTS.notebook,
    nameKey: 'learn.sandbox.products.notebook',
    name: 'دفتر ۱۰۰ برگ جلد سخت',
    category: 'stationery',
    targetMarginPercent: 40,
    pricedOn: 'last',
    readings: [
      { monthsAgo: 6, cost: 62_000, source: 'save' },
      { monthsAgo: 4, cost: 70_000, source: 'update' },
      { monthsAgo: 2, cost: 78_000, source: 'update' },
    ],
  },
  {
    id: SEED_PRODUCTS.battery,
    nameKey: 'learn.sandbox.products.battery',
    name: 'باتری قلمی آلکالاین ۴ عددی',
    /* 'digital' — the CPI division for communication and recreation equipment — not 'home'.
     * `category` is what the national price-rise figure is looked up by, so filing batteries
     * under kitchenware would have the smartRates lesson explain them with the wrong index. */
    category: 'digital',
    targetMarginPercent: 25,
    pricedOn: 'last',
    readings: [
      { monthsAgo: 3, cost: 185_000, source: 'save' },
      { monthsAgo: 1, cost: 198_000, source: 'update' },
    ],
  },
]

/** The demo shopkeeper's setup. Food first, because that is what most of the shelf is. */
export const SEED_PROFILE: StoreProfile = {
  id: 'me',
  categories: ['food', 'digital', 'beauty', 'stationery'],
  importDependency: 0.5,
}

/** Product id → the i18n key its name lives under, for a caller that re-labels at render time. */
export const SEED_NAME_KEYS: Record<number, string> = Object.fromEntries(
  SEED.map((spec) => [spec.id, spec.nameKey]),
)

export interface SeedData {
  products: Product[]
  observations: Observation[]
  profile: StoreProfile
}

/** Rounded to whole milliseconds so a seeded row looks exactly like one the app would have written. */
function at(now: number, monthsAgo: number): number {
  return Math.round(now - monthsAgo * MS_PER_MONTH)
}

/**
 * Pure: the whole demo shop as rows, dated against `now`. No database, no clock of its own —
 * which is what makes a lesson's expected answer computable in a script and testable here.
 */
export function buildSeed(now: number, translate: SeedTranslate = PERSIAN): SeedData {
  const products: Product[] = []
  const observations: Observation[] = []
  let observationId = 1

  for (const spec of SEED) {
    const readings = spec.readings
    const first = readings[0]
    const last = readings[readings.length - 1]
    /* A product with no reading could not be dated or priced, and would teach a lesson nothing.
     * The guard is here rather than in a comment because SEED is edited by hand. */
    if (first === undefined || last === undefined) continue

    for (const reading of readings) {
      observations.push({
        id: observationId++,
        productId: spec.id,
        cost: reading.cost,
        observedAt: at(now, reading.monthsAgo),
        ...(reading.excluded === true ? { excluded: true } : {}),
        source: reading.source,
      })
    }

    const basis = spec.pricedOn === 'first' ? first : last
    const note = spec.noteKey === undefined || spec.note === undefined ? spec.note : translate(spec.noteKey, spec.note)
    products.push({
      id: spec.id,
      name: translate(spec.nameKey, spec.name),
      cost: last.cost,
      targetMarginPercent: spec.targetMarginPercent,
      price: roundUpTo(basis.cost * (1 + spec.targetMarginPercent / 100), SEED_ROUNDING),
      unit: 'toman',
      ...(note === undefined ? {} : { note }),
      costUpdatedAt: at(now, last.monthsAgo),
      category: spec.category,
      createdAt: at(now, first.monthsAgo),
      updatedAt: at(now, last.monthsAgo),
    })
  }

  return { products, observations, profile: { ...SEED_PROFILE, categories: [...SEED_PROFILE.categories] } }
}

/**
 * Writes the demo shop into a freshly created practice database, in one transaction: a half-seeded
 * shop would have a lesson explaining figures that are not on the screen.
 */
export async function seedPractice(db: PracticeDb, now: number, translate?: SeedTranslate): Promise<SeedData> {
  const seed = buildSeed(now, translate)
  await db.transaction('rw', db.products, db.observations, db.storeProfile, async () => {
    await db.products.bulkAdd(seed.products)
    await db.observations.bulkAdd(seed.observations)
    await db.storeProfile.put(seed.profile)
  })
  return seed
}
