import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'sooda:theme'
const LIGHT_BAR = '#f2f2f7'
const DARK_BAR = '#000000'

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // storage unavailable
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(pref: ThemePreference): boolean {
  const isDark = pref === 'dark' || (pref === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', isDark)
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = isDark ? DARK_BAR : LIGHT_BAR
  }
  return isDark
}

export function useTheme(): {
  preference: ThemePreference
  isDark: boolean
  setPreference: (pref: ThemePreference) => void
  toggle: () => void
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredTheme)
  const [isDark, setIsDark] = useState<boolean>(() => applyTheme(readStoredTheme()))

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref)
    } catch {
      // best-effort persistence
    }
    setIsDark(applyTheme(pref))
  }, [])

  const toggle = useCallback(() => {
    setPreference(isDark ? 'light' : 'dark')
  }, [isDark, setPreference])

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setIsDark(applyTheme('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  return { preference, isDark, setPreference, toggle }
}
