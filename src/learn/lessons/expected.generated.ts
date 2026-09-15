/*
 * GENERATED — `node scripts/lesson-examples.mjs --write`. Do not edit by hand.
 *
 * Every figure below came out of the app's own engine at the pinned tutorial rate. The lessons
 * import this file rather than the engine, so opening a lesson does not drag the calculators,
 * the bulk preview and the basket adder into the tutorial chunk — and `--check`, plus
 * `expected.test.ts`, fail the moment the engine and this snapshot disagree.
 */

import type { LessonExpected, LessonInputs } from './types'

export const LESSON_EXPECTED: LessonExpected = {
  "profit": {
    "sellingPrice": 188000,
    "profitAmount": 38000
  },
  "discount": {
    "finalPrice": 350000,
    "originalPrice": 500000
  },
  "realProfit": {
    "replacement": 128941.79,
    "realPercent": -0.73,
    "verdict": "losing"
  },
  "installments": {
    "monthly": 2215170.01,
    "total": 13291020.03,
    "reverseGainPercent": 1.12,
    "reverseVerdict": "healthy"
  },
  "products": {
    "costUpPercent": 10,
    "newCosts": [
      {
        "id": 2,
        "cost": 129800
      },
      {
        "id": 3,
        "cost": 261800
      },
      {
        "id": 4,
        "cost": 85800
      },
      {
        "id": 5,
        "cost": 217800
      }
    ]
  },
  "smartRates": {
    "seedObservationCount": 15
  },
  "mission": {
    "sellingPrice": 120000,
    "profitAmount": 20000,
    "replacement": 109272.7,
    "realPercent": 9.82,
    "verdict": "thin",
    "suggested": 132000
  },
  "everyday": {
    "combinedProfit": 308000
  }
}

export const LESSON_INPUTS: LessonInputs = {
  "profit": {
    "cost": "150000",
    "margin": "25",
    "sellPrice": "140000"
  },
  "discount": {
    "original": "500000",
    "off": "30",
    "final": "350000"
  },
  "realProfit": {
    "cost": "118000",
    "price": "128000",
    "months": "3",
    "knownCost": "130000"
  },
  "installments": {
    "cash": "12000000",
    "count": "6",
    "flat": "2"
  },
  "products": {
    "cost": "120000",
    "margin": "20",
    "name": "چای کیسه‌ای",
    "newCost": "2700000",
    "bulkPercent": "10"
  },
  "smartRates": {
    "manualRate": "4"
  },
  "mission": {
    "cost": "100000",
    "margin": "20",
    "months": "3"
  },
  "everyday": {
    "riceCost": "2480000",
    "riceMargin": "12",
    "oilCost": "118000",
    "oilMargin": "8"
  }
}
