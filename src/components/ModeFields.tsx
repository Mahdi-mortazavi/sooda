import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import { visibleFields } from '../lib/modes/registry'
import type { FieldSpec, ModeId, ModeState } from '../lib/modes/types'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { ChipRow } from './ChipRow'
import { NumberField } from './NumberField'
import { SegmentedControl } from './SegmentedControl'

interface ModeFieldsProps {
  mode: ModeId
  state: ModeState
  errors: Record<string, ValidationError>
  lang: AppLanguage
  onChange: (key: string, value: string) => void
}

/** Renders one glass card of inputs straight from the active mode's field specs. */
export function ModeFields({ mode, state, errors, lang, onChange }: ModeFieldsProps) {
  const fields = visibleFields(mode, state).filter((field) => field.group !== 'lens')

  return (
    <div className="glass glass-ring rounded-3xl">
      {fields.map((field, index) => (
        <Fragment key={field.key}>
          {index > 0 && <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />}
          <ModeField
            mode={mode}
            field={field}
            state={state}
            error={errors[field.key]}
            lang={lang}
            onChange={onChange}
          />
        </Fragment>
      ))}
    </div>
  )
}

function ModeField({
  mode,
  field,
  state,
  error,
  lang,
  onChange,
}: {
  mode: ModeId
  field: FieldSpec
  state: ModeState
  error: ValidationError | undefined
  lang: AppLanguage
  onChange: (key: string, value: string) => void
}) {
  const { t } = useTranslation()
  const value = state[field.key] ?? ''
  const label = t(field.labelKey)
  const optionLabel = (index: number, fallback: string) => t(field.optionLabelKeys?.[index] ?? fallback)

  if (field.kind === 'toggle') {
    return (
      <div className="px-5 py-3">
        <SegmentedControl<string>
          layoutId={`${mode}-${field.key}`}
          ariaLabel={label}
          value={value || (field.defaultValue ?? '')}
          onChange={(next) => onChange(field.key, next)}
          size="sm"
          options={(field.options ?? []).map((option, index) => ({ value: option, label: optionLabel(index, option) }))}
        />
      </div>
    )
  }

  if (field.kind === 'chips') {
    const options = (field.options ?? []).map((option, index) => ({
      value: option,
      // Numeric chips (instalment counts) show the number itself, localised.
      label: field.optionLabelKeys ? optionLabel(index, option) : formatChip(option, lang),
    }))
    // A typed-in value that is not one of the presets still has to be visible somewhere.
    const isCustom = value !== '' && !options.some((option) => option.value === value)
    return (
      <div className="px-5 py-3.5">
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">{label}</p>
        <ChipRow
          options={options}
          value={value}
          onChange={(next) => onChange(field.key, next)}
          layoutId={`${mode}-${field.key}`}
          ariaLabel={label}
        />
        {field.allowCustom && (
          <div className="-mx-5 -mb-3.5 mt-1">
            <NumberField
              id={`${mode}-${field.key}-custom`}
              label={t('installment.countCustom')}
              value={isCustom ? value : ''}
              onChange={(next) => onChange(field.key, next)}
              placeholder={t('fields.amountPlaceholder')}
              lang={lang}
              error={error ? t(`errors.${error}`) : null}
            />
          </div>
        )}
        {!field.allowCustom && error ? (
          <p role="alert" className="mt-1 text-[13px] font-medium text-loss-600 dark:text-loss-400">
            {t(`errors.${error}`)}
          </p>
        ) : null}
      </div>
    )
  }

  const isPercent = field.kind === 'percent'
  return (
    <NumberField
      id={`${mode}-${field.key}`}
      label={label}
      value={value}
      onChange={(next) => onChange(field.key, next)}
      placeholder={isPercent ? t('fields.percentPlaceholder') : t('fields.amountPlaceholder')}
      lang={lang}
      unit={isPercent ? t('fields.percentUnit') : undefined}
      error={error ? t(`errors.${error}`) : null}
    />
  )
}

function formatChip(option: string, lang: AppLanguage): string {
  const parsed = Number(option)
  return Number.isFinite(parsed) ? formatNumber(parsed, lang, 0) : option
}
