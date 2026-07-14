interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  unit?: string
  error?: string | null
}

/** Labeled decimal input that accepts Latin, Persian and Arabic-Indic digits. */
export function NumberField({ id, label, value, onChange, placeholder, unit, error }: NumberFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="px-5 py-3.5">
      <label htmlFor={id} className="block text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">
        {label}
      </label>
      <div className="mt-0.5 flex items-baseline gap-2">
        <input
          id={id}
          type="text"
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-[13px] font-medium text-loss-600 dark:text-loss-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
