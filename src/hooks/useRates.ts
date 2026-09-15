import { useCallback, useEffect, useState } from 'react'
import type { RatesFile } from '../lib/rates/schema'

export type RatesOrigin = 'loading' | 'network' | 'stored' | 'fallback'

export interface RatesHandle {
  /** null only while the first dynamic import is in flight — never an error state. */
  rates: RatesFile | null
  origin: RatesOrigin
  /** Re-reads the file now, e.g. after the auto-update toggle is switched back on. */
  refresh: () => void
}

/*
 * The rates module is loaded with a dynamic import rather than a static one so that the
 * bundled fallback file and the schema guard stay out of the entry chunk. Nothing on the
 * first screen needs a rate: the figures matter on the products tab and inside the lens,
 * both of which are already behind their own chunks.
 */
export function useRates(enabled: boolean): RatesHandle {
  const [rates, setRates] = useState<RatesFile | null>(null)
  const [origin, setOrigin] = useState<RatesOrigin>('loading')
  // Bumping this re-runs the effect, which is how `refresh` re-enters the same code path.
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) return
    // Aborts the fetch if the app is torn down (or the language chosen) mid-flight.
    const controller = new AbortController()
    let live = true

    void (async () => {
      const load = await import('../lib/rates/load')
      if (!live) return
      /* Paint the cached value first. refreshRates awaits the network, and a shopkeeper on a
       * slow connection should not watch an empty rate card while it does. */
      const cached = load.readCachedRates()
      setRates(cached.rates)
      setOrigin(cached.origin)

      const fresh = await load.refreshRates(controller.signal)
      if (!live) return
      setRates(fresh.rates)
      setOrigin(fresh.origin)
    })().catch(() => {
      // Only reachable if the rates chunk itself fails to load; refreshRates never throws.
      if (live) setOrigin('fallback')
    })

    return () => {
      live = false
      controller.abort()
    }
  }, [enabled, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  return { rates, origin, refresh }
}
