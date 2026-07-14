import { useEffect, useState } from 'react'

// Keep these literals in sync with BASKET_COUNT_KEY / BASKET_COUNT_EVENT in lib/db.ts.
// They are duplicated here deliberately: importing db.ts would pull Dexie into the
// main bundle, and the badge must render before the basket chunk ever loads.
const KEY = 'sooda:basket-count'
const EVENT = 'sooda:basket-count'

/** Live basket item count for the header badge, without loading Dexie. */
export function useBasketCount(): number {
  const [count, setCount] = useState(() => {
    try {
      return Number(localStorage.getItem(KEY)) || 0
    } catch {
      return 0
    }
  })

  useEffect(() => {
    const onChange = (e: Event) => setCount((e as CustomEvent<number>).detail ?? 0)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  return count
}
