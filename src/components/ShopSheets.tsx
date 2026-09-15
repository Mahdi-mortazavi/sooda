import { lazy, Suspense, useCallback } from 'react'
import type { CheckInItem } from './CheckInSheet'
import type { StoreProfile } from '../lib/db'
import type { AppLanguage } from '../lib/numbers'
import type { Unit } from '../lib/units'

const CheckInSheet = lazy(() => import('./CheckInSheet').then((m) => ({ default: m.CheckInSheet })))
const StoreProfileSheet = lazy(() => import('./StoreProfileSheet').then((m) => ({ default: m.StoreProfileSheet })))

interface ShopSheetsProps {
  checkInOpen: boolean
  onCloseCheckIn: () => void
  profileOpen: boolean
  onCloseProfile: () => void
  items: CheckInItem[]
  now: number
  profile: StoreProfile | null
  lang: AppLanguage
  unit: Unit
  /** Re-reads the stale list and the badge after anything here writes. */
  onChanged: () => void
  onReprice: (productIds: number[]) => void
}

/**
 * The two sheets that answer questions the user has not asked yet, plus the writes behind
 * them. App mounts this only once one of them is actually open, which keeps both the sheets
 * and the profile-writing code out of the entry chunk.
 */
export function ShopSheets({
  checkInOpen,
  onCloseCheckIn,
  profileOpen,
  onCloseProfile,
  items,
  now,
  profile,
  lang,
  unit,
  onChanged,
  onReprice,
}: ShopSheetsProps) {
  const saveProfile = useCallback(
    async (draft: Omit<StoreProfile, 'id'>) => {
      const { writeStoreProfile } = await import('../lib/observations')
      await writeStoreProfile({ id: 'me', ...draft })
      onCloseProfile()
      // Every estimate in the app just changed its prior, so the stale list is recomputed.
      onChanged()
    },
    [onCloseProfile, onChanged],
  )

  /* Skipping still writes the neutral default. Remembering the skip is the point: an optional
   * question that reappears on every launch is not optional in practice. */
  const skipProfile = useCallback(async () => {
    const { writeStoreProfile, DEFAULT_PROFILE } = await import('../lib/observations')
    await writeStoreProfile(DEFAULT_PROFILE)
    onCloseProfile()
    onChanged()
  }, [onCloseProfile, onChanged])

  return (
    <Suspense fallback={null}>
      {checkInOpen && (
        <CheckInSheet
          open={checkInOpen}
          onClose={() => {
            onCloseCheckIn()
            // Whatever was recorded changes both the estimates and the badge.
            onChanged()
          }}
          items={items}
          lang={lang}
          unit={unit}
          now={now}
          onFinish={onChanged}
          onReprice={onReprice}
        />
      )}
      {profileOpen && (
        <StoreProfileSheet
          open={profileOpen}
          onClose={onCloseProfile}
          initial={{
            categories: profile?.categories ?? ['other'],
            importDependency: profile?.importDependency ?? 0.5,
          }}
          onSave={(draft) => void saveProfile(draft)}
          onSkip={() => void skipProfile()}
        />
      )}
    </Suspense>
  )
}
