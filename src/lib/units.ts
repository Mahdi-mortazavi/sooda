import { formatNumber, type AppLanguage } from './numbers'

/** Currency/unit presets. 'none' shows plain numbers. */
export type Unit = 'none' | 'toman' | 'rial' | 'usd' | 'eur'

export const UNITS: readonly Unit[] = ['none', 'toman', 'rial', 'usd', 'eur'] as const

export const UNIT_STORAGE_KEY = 'sooda:unit'

interface UnitMeta {
  /** Short label used in the settings picker. */
  short: Record<AppLanguage, string>
  /** Word/symbol attached to amounts, or null for plain numbers. */
  en: { text: string; position: 'prefix' | 'suffix' } | null
  fa: { text: string; position: 'prefix' | 'suffix' } | null
}

const META: Record<Unit, UnitMeta> = {
  none: { short: { en: '—', fa: '—' }, en: null, fa: null },
  toman: {
    short: { en: 'Toman', fa: 'تومان' },
    en: { text: ' Toman', position: 'suffix' },
    fa: { text: ' تومان', position: 'suffix' },
  },
  rial: {
    short: { en: 'Rial', fa: 'ریال' },
    en: { text: ' Rial', position: 'suffix' },
    fa: { text: ' ریال', position: 'suffix' },
  },
  usd: {
    short: { en: '$', fa: '$' },
    en: { text: '$', position: 'prefix' },
    fa: { text: ' دلار', position: 'suffix' },
  },
  eur: {
    short: { en: '€', fa: '€' },
    en: { text: '€', position: 'prefix' },
    fa: { text: ' یورو', position: 'suffix' },
  },
}

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value)
}

export function unitShortLabel(unit: Unit, lang: AppLanguage): string {
  return META[unit].short[lang]
}

/** The unit word/symbol for display next to an amount, or empty string for 'none'. */
export function unitAffix(unit: Unit, lang: AppLanguage): { text: string; position: 'prefix' | 'suffix' } | null {
  return META[unit][lang]
}

/** Format a money amount with the active unit (percent values should NOT go through this). */
export function formatAmountWithUnit(value: number, lang: AppLanguage, unit: Unit): string {
  const num = formatNumber(value, lang)
  const affix = META[unit][lang]
  if (!affix) return num
  return affix.position === 'prefix' ? `${affix.text}${num}` : `${num}${affix.text}`
}

export function readStoredUnit(): Unit {
  try {
    const stored = localStorage.getItem(UNIT_STORAGE_KEY)
    if (isUnit(stored)) return stored
  } catch {
    // storage unavailable
  }
  return 'none'
}

export function storeUnit(unit: Unit): void {
  try {
    localStorage.setItem(UNIT_STORAGE_KEY, unit)
  } catch {
    // best-effort persistence
  }
}
