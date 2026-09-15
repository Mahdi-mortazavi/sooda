import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import { visibleFields } from '../lib/modes/registry'
import type { FieldSpec, ModeId, ModeState } from '../lib/modes/types'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { ChipRow } from './ChipRow'
import { NumberField } from './NumberField'
import { SegmentedControl } from './SegmentedControl'

/** Sentinel for the "type your own" chip; it is never a field value. */
const CUSTOM_CHIP = '__custom__'

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
    <div data-tour="calc-panel" className="glass glass-ring rounded-3xl">
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
          tourPrefix={`chip-${field.key}-`}
          options={(field.options ?? []).map((option, index) => ({ value: option, label: optionLabel(index, option) }))}
        />
      </div>
    )
  }

  if (field.kind === 'chips') {
    const presets = (field.options ?? []).map((option, index) => ({
      value: option,
      // Numeric chips (instalment terms) show the number itself, localised.
      label: field.optionLabelKeys ? optionLabel(index, option) : formatChip(option, lang),
    }))
    // Anything the user typed in is "custom"; so is an empty value, which is how the chip clears.
    const custom = value === '' || !presets.some((option) => option.value === value)
    const options = field.allowCustom
      ? [...presets, { value: CUSTOM_CHIP, label: t('installment.countCustom') }]
      : presets
    return (
      <div className="px-5 py-3.5">
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">{label}</p>
        <ChipRow
          options={options}
          value={field.allowCustom && custom ? CUSTOM_CHIP : value}
          onChange={(next) => onChange(field.key, next === CUSTOM_CHIP ? '' : next)}
          layoutId={`${mode}-${field.key}`}
          ariaLabel={label}
          tour={`field-${field.key}`}
          tourKey={field.key}
        />
        {field.allowCustom && custom && (
          <div className="-mx-5 -mb-3.5 mt-1">
            <NumberField
              id={`${mode}-${field.key}-custom`}
              label={t('installment.countCustom')}
              value={value}
              onChange={(next) => onChange(field.key, next)}
              placeholder={t('fields.amountPlaceholder')}
              lang={lang}
              error={error ? t(`errors.${error}`) : null}
              /* No `data-tour`: the chip row above already carries `field-<key>`, and a second
                 element with the same name would make the coach point at whichever came first. */
              tourField={field.key}
            />
          </div>
        )}
        {!(field.allowCustom && custom) && error ? (
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
      tourField={field.key}
      tour={`field-${field.key}`}
    />
  )
}

function formatChip(option: string, lang: AppLanguage): string {
  const parsed = Number(option)
  return Number.isFinite(parsed) ? formatNumber(parsed, lang, 0) : option
}
