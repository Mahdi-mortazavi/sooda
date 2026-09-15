// The app-icon badge is the only nudge Sooda can give a closed app: a push
// notification would need a server and a subscription, and Sooda has neither.
// Badging is also the flakiest web API we touch — unsupported on most desktop
// browsers, permission-gated on others — so every call here is best-effort.

/** The Badging API is not in the default TypeScript DOM lib, so declare the two calls we use. */
interface BadgingNavigator {
  setAppBadge: (contents?: number) => Promise<void>
  clearAppBadge: () => Promise<void>
}

/** Null on any platform missing either half of the API — a one-sided implementation is not usable. */
function badgingNavigator(): BadgingNavigator | null {
  if (typeof navigator === 'undefined') return null
  const candidate = navigator as Navigator & Partial<BadgingNavigator>
  const { setAppBadge, clearAppBadge } = candidate
  if (typeof setAppBadge !== 'function' || typeof clearAppBadge !== 'function') return null
  return { setAppBadge: setAppBadge.bind(candidate), clearAppBadge: clearAppBadge.bind(candidate) }
}

/** True when the platform supports app badging at all. */
export function isBadgeSupported(): boolean {
  return badgingNavigator() !== null
}

/** Sets the badge, or clears it at 0. Best-effort: feature-detected, never throws, never rejects. */
export async function setStaleBadge(count: number): Promise<void> {
  const badging = badgingNavigator()
  if (badging === null) return
  try {
    // setAppBadge(0) still paints a dot on some platforms, so nothing-to-do clears.
    if (!Number.isFinite(count) || count <= 0) await badging.clearAppBadge()
    else await badging.setAppBadge(Math.floor(count))
  } catch {
    // permission denied, or an implementation that advertises the method and rejects
  }
}

export async function clearBadge(): Promise<void> {
  const badging = badgingNavigator()
  if (badging === null) return
  try {
    await badging.clearAppBadge()
  } catch {
    // same story — a stuck badge is a blemish, never an error worth surfacing
  }
}
