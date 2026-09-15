import { useContext, useLayoutEffect, useRef } from 'react'
import type { AppLanguage } from '../lib/numbers'
import { countSignificantChars, formatLiveInput, parseAmount, sanitizeNumericInput } from '../lib/numbers'
import { emitTour } from '../learn/coach/events'
import { RepositoryContext } from '../learn/ui/repositoryContext'

interface NumberFieldProps {
  id: string
  label: string
  /** Canonical raw value, e.g. "250000.5" — display adds live grouping per language. */
  value: string
  onChange: (value: string) => void
  placeholder: string
  lang: AppLanguage
  unit?: string
  error?: string | null
  /**
   * The field id this input stands for, in the tour's vocabulary. Given one, the field announces
   * `field:change` as it is typed and `field:commit` when it is left — which is what a lesson step
   * waits for. The component learns nothing about the tour beyond the name; with no lesson
   * listening `emitTour` is a comparison and a return.
   */
  tourField?: string
  /** The `data-tour` name, from `src/learn/lessons/targets.ts`. */
  tour?: string
}

/**
 * Labeled decimal input with live 3-digit grouping (۲۵۰٬۰۰۰ / 250,000).
 * Accepts Latin, Persian and Arabic-Indic digits; stores a canonical ASCII value.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  lang,
  unit,
  error,
  tourField,
  tour,
}: NumberFieldProps) {
  const errorId = `${id}-error`
  /* Only while the tutorial is offering one for this field, and only while the field is still
   * empty: a chip that stays after the figure is in is a chip in the way. Read straight from the
   * context rather than through `useRepository`, which would pull Dexie into the entry chunk. */
  const offered = useContext(RepositoryContext)?.suggestion ?? null
  const suggestion = offered !== null && offered.field === tourField && value === '' ? offered : null
  const inputRef = useRef<HTMLInputElement>(null)
  const caretDigits = useRef<number | null>(null)

  const display = formatLiveInput(value, lang)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const text = el.value
    const caret = el.selectionStart ?? text.length
    const raw = sanitizeNumericInput(text)
    if (raw === null) {
      // Invalid character — restore the previous display and caret.
      el.value = display
      const pos = Math.max(0, caret - 1)
      el.setSelectionRange(pos, pos)
      return
    }
    caretDigits.current = countSignificantChars(text.slice(0, caret))
    onChange(raw)
    if (tourField !== undefined) emitTour({ type: 'field:change', field: tourField, value: raw })
  }

  /* Blur is the commit: it is what the ghost finger does after typing, and what a shopkeeper does
   * by tapping the next field. A non-numeric value is not a commit — there is nothing to judge. */
  const handleBlur = () => {
    if (tourField === undefined) return
    const parsed = parseAmount(value)
    if (Number.isFinite(parsed)) emitTour({ type: 'field:commit', field: tourField, value: parsed })
  }

  // After re-render with fresh grouping, put the caret back after the same digit count.
  useLayoutEffect(() => {
    const el = inputRef.current
    const target = caretDigits.current
    caretDigits.current = null
    if (target === null || !el || document.activeElement !== el) return
    let pos = 0
    let seen = 0
    while (pos < display.length && seen < target) {
      const ch = display[pos] as string
      if (/[\d.\-۰-۹٫]/.test(ch)) seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
  }, [display])

  return (
    <div data-tour={tour} className="px-5 py-3.5">
      <label htmlFor={id} className="block text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">
        {label}
      </label>
      <div className="mt-0.5 flex items-baseline gap-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full min-w-0 bg-transparent text-[28px] font-semibold tracking-tight text-[var(--text-primary)] outline-none placeholder:font-medium"
        />
        {unit ? (
          <span aria-hidden className="text-[22px] font-medium text-[var(--text-tertiary)]">
            {unit}
          </span>
        ) : null}
      </div>
      {suggestion ? (
        <button
          type="button"
          data-tour={`chip-suggest-${suggestion.field}`}
          onClick={() => {
            onChange(suggestion.value)
            /* A change, not a commit: nothing was focused, so nothing will blur. `filled()` — the
               predicate a suggestion step is written with — accepts either, for exactly this. */
            emitTour({ type: 'field:change', field: suggestion.field, value: suggestion.value })
          }}
          className="mt-2 rounded-full bg-accent-500/16 px-3 py-1 text-[13px] font-bold text-[var(--accent-text)]"
        >
          {suggestion.label}
        </button>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-[13px] font-medium text-loss-600 dark:text-loss-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
