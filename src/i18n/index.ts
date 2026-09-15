import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppLanguage } from '../lib/numbers'

export const LANG_STORAGE_KEY = 'sooda:lang'

/*
 * Only the language actually in use is downloaded. Bundling both more than
 * doubled the translation payload in the entry chunk once v1.3 tripled the
 * string count; as separate chunks they are still precached by the service
 * worker, so switching language works offline and costs nothing on repeat loads.
 */
const LOADERS: Record<AppLanguage, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./en.json'),
  fa: () => import('./fa.json'),
}

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

async function ensureBundle(lang: AppLanguage): Promise<void> {
  if (i18n.hasResourceBundle(lang, 'translation')) return
  const mod = await LOADERS[lang]()
  i18n.addResourceBundle(lang, 'translation', mod.default, true, true)
}

/** Loads the detected language and initialises i18next. Resolves before the app renders. */
export async function initI18n(): Promise<AppLanguage> {
  const lang = detectLanguage()
  const mod = await LOADERS[lang]()
  await i18n.use(initReactI18next).init({
    resources: { [lang]: { translation: mod.default } },
    lng: lang,
    // The other language is not in memory yet, so falling back to it would render raw keys.
    fallbackLng: lang,
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  return lang
}

export async function setLanguage(lang: AppLanguage): Promise<void> {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // best-effort persistence
  }
  await ensureBundle(lang)
  await i18n.changeLanguage(lang)
  applyDocumentLanguage(lang)
}

export default i18n
