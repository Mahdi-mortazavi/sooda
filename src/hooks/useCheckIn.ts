import { useCallback, useEffect, useState } from 'react'
import type { CheckInItem } from '../components/CheckInSheet'
import type { StoreProfile } from '../lib/db'
import type { RatesFile } from '../lib/rates/schema'

export interface CheckInData {
  /** Worst-first: the products whose cost has most likely moved since it was last checked. */
  items: CheckInItem[]
  /** The instant every estimate above was pinned to. Hand this straight to CheckInSheet. */
  now: number
  profile: StoreProfile | null
  /** null while unknown. false means setup has genuinely never been answered. */
  hasProfile: boolean | null
  productCount: number
  /** Re-reads Dexie — call after a check-in run, a bulk reprice, or a profile change. */
  reload: () => void
}

const EMPTY: CheckInItem[] = []

/**
 * Holds the check-in state and badges the app icon with the count. All of the work, and
 * every module that does it, is behind the dynamic imports below: this hook is imported
 * statically by App, so anything static here would land in the bytes that decide first paint.
 *
 * Deliberately read-only. Writing a reading is the sheet's job, and this hook finding out
 * about it is what `reload` is for.
 */
export function useCheckIn(rates: RatesFile | null, enabled: boolean): CheckInData {
  const [state, setState] = useState<Omit<CheckInData, 'reload'>>({
    items: EMPTY,
    now: 0,
    profile: null,
    hasProfile: null,
    productCount: 0,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    // `rates` null means the file has not loaded yet, not that there is nothing to say;
    // running now would estimate every product from no prior and badge the wrong count.
    if (!enabled || rates === null) return
    let live = true

    void (async () => {
      const [{ computeCheckIn }, badge] = await Promise.all([import('../lib/checkin'), import('../lib/badge')])
      if (!live) return
      const snapshot = await computeCheckIn(rates)
      if (!live) return
      setState(snapshot)
      void badge.setStaleBadge(snapshot.items.length)
    })()

    return () => {
      live = false
    }
  }, [rates, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { ...state, reload }
}
