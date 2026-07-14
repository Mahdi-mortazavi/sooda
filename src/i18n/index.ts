import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppLanguage } from '../lib/numbers'
import en from './en.json'
import fa from './fa.json'

export const LANG_STORAGE_KEY = 'sooda:lang'

export function detectLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (stored === 'en' || stored === 'fa') return stored
  } catch {
    // storage unavailable — fall through to navigator detection
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('fa') ? 'fa' : 'en'
}

export function applyDocumentLanguage(lang: AppLanguage): void {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
}

export async function setLanguage(lang: AppLanguage): Promise<void> {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // best-effort persistence
  }
  await i18n.changeLanguage(lang)
  applyDocumentLanguage(lang)
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
