/** Persian (U+06F0–U+06F9) and Arabic-Indic (U+0660–U+0669) digit handling + locale formatting. */

const PERSIAN_ZERO = 0x06f0
const ARABIC_ZERO = 0x0660

/** Characters treated as grouping separators and stripped: `,` `،` `٬` spaces, NBSP, NNBSP. */
const GROUPING_RE = /[,،٬\s  ’']/g

/** Convert Persian/Arabic-Indic digits to ASCII and normalize decimal separators (`٫` and `/`) to `.`. */
export function normalizeDigits(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0) as number
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
      out += String(code - PERSIAN_ZERO)
    } else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) {
      out += String(code - ARABIC_ZERO)
    } else if (ch === '٫' || ch === '/') {
      // Arabic decimal separator or Persian-keyboard slash → decimal point
      out += '.'
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Parse user input that may contain Persian/Arabic digits, localized separators
 * and grouping characters. Returns NaN for anything that isn't a clean number.
 */
export function parseAmount(raw: string): number {
  const cleaned = normalizeDigits(raw).replace(GROUPING_RE, '')
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return NaN
  return Number.parseFloat(cleaned)
}

export type AppLanguage = 'en' | 'fa'

const LOCALES: Record<AppLanguage, string> = { en: 'en-US', fa: 'fa-IR' }

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(lang: AppLanguage, maxFractionDigits: number): Intl.NumberFormat {
  const key = `${lang}:${maxFractionDigits}`
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALES[lang], {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: 0,
    })
    formatterCache.set(key, fmt)
  }
  return fmt
}

/** Format a number for display: `fa` → Persian digits with fa-IR grouping, `en` → en-US grouping. */
export function formatNumber(value: number, lang: AppLanguage, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  // Avoid "-0"
  const v = Object.is(value, -0) ? 0 : value
  return getFormatter(lang, maxFractionDigits).format(v)
}

/** Format a percentage value (number only; the % sign is added by the caller/i18n). */
export function formatPercentValue(value: number, lang: AppLanguage): string {
  return formatNumber(value, lang, 2)
}
