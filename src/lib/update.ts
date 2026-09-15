// An installed PWA can stay open for days, and a service worker only re-checks
// its script on navigation. Without these nudges a user who never fully closes
// the app would keep running the build they installed with.

/** How often a running app asks the browser to re-check the service worker. */
export const UPDATE_INTERVAL_MS = 60 * 60 * 1000

/** Floor between two focus-triggered checks, so tab switching cannot spam the network. */
export const VISIBILITY_THROTTLE_MS = 10 * 60 * 1000

export const LAST_SEEN_VERSION_KEY = 'sooda:last-version'

interface UpdateOptions {
  /** Injected clock, so the focus throttle is testable without fake timers. */
  now?: () => number
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Periodically ask the browser to re-check the service worker so a long-open
 * installed PWA cannot sit on a stale build. Returns a teardown function.
 * Skips every check while navigator.onLine === false.
 */
export function startUpdateChecks(registration: ServiceWorkerRegistration, options?: UpdateOptions): () => void {
  const now = options?.now ?? Date.now
  // Negative infinity rather than now(): the very first focus check must run.
  let lastChecked = Number.NEGATIVE_INFINITY

  const check = (): void => {
    if (isOffline()) return
    lastChecked = now()
    try {
      // Chrome rejects update() when the network is unreachable and Safari can
      // throw outright; a failed check is never worth surfacing to the user.
      void Promise.resolve(registration.update()).catch(() => undefined)
    } catch {
      // update() threw synchronously — same story, ignore it.
    }
  }

  const onVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    // Shared timestamp: a focus right after an interval tick is already covered.
    if (now() - lastChecked < VISIBILITY_THROTTLE_MS) return
    check()
  }

  const interval = setInterval(check, UPDATE_INTERVAL_MS)
  const hasDocument = typeof document !== 'undefined'
  if (hasDocument) document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    clearInterval(interval)
    if (hasDocument) document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export function readLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY)
  } catch {
    // storage unavailable
    return null
  }
}

export function storeLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version)
  } catch {
    // best-effort persistence
  }
}

/** False on a first install (nothing stored) and when the versions match — What's New must not show then. */
export function shouldShowWhatsNew(current: string, stored: string | null): boolean {
  if (stored === null || stored === '') return false
  return compareVersions(current, stored) > 0
}

/** Numeric-segment compare; a stored version newer than the running one must not trigger What's New. */
function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

function parseVersion(value: string): number[] {
  // Drops any prerelease/build suffix: '1.3.0-rc.1' compares as 1.3.0.
  const base = value.split('-')[0] ?? value
  return base
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part, 10)
      return Number.isFinite(n) ? n : 0
    })
}
