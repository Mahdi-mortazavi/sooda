import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'sooda:install-dismissed'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000 // re-offer after 14 days

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

function dismissedRecently(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts < SNOOZE_MS
  } catch {
    return false
  }
}

export interface InstallPromptState {
  /** Show the install UI at all (not installed, not recently dismissed, and installable). */
  available: boolean
  /** True when the native browser prompt can be triggered (Chromium). */
  canNativePrompt: boolean
  /** True on iOS Safari, where installation is manual via Add to Home Screen. */
  ios: boolean
  promptInstall: () => Promise<void>
  dismiss: () => void
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => isStandalone() || dismissedRecently())
  const ios = isIOS()

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setHidden(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    if (choice.outcome === 'accepted') setHidden(true)
  }, [deferred])

  const dismiss = useCallback(() => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // best-effort persistence
    }
  }, [])

  return {
    available: !hidden && (deferred !== null || ios),
    canNativePrompt: deferred !== null,
    ios,
    promptInstall,
    dismiss,
  }
}
