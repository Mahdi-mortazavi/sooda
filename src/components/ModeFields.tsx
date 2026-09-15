import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import { visibleFields } from '../lib/modes/registry'
import type { ModeId, ModeState } from '../lib/modes/types'
import type { AppLanguage } from '../lib/numbers'
import { NumberField } from './NumberField'

interface ModeFieldsProps {
  mode: ModeId
  state: ModeState
  errors: Record<string, ValidationError>
  lang: AppLanguage
  onChange: (key: string, value: string) => void
}

/** Renders one glass card of inputs straight from the active mode's field specs. */
export function ModeFields({ mode, state, errors, lang, onChange }: ModeFieldsProps) {
  const { t } = useTranslation()
  const pct = t('fields.percentUnit')
  const fields = visibleFields(mode, state)

  return (
    <div className="glass glass-ring rounded-3xl">
      {fields.map((field, index) => {
        const isPercent = field.kind === 'percent'
        const error = errors[field.key]
        return (
          <Fragment key={field.key}>
            {index > 0 && <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />}
            <NumberField
              id={`${mode}-${field.key}`}
              label={t(field.labelKey)}
              value={state[field.key] ?? ''}
              onChange={(value) => onChange(field.key, value)}
              placeholder={isPercent ? t('fields.percentPlaceholder') : t('fields.amountPlaceholder')}
              lang={lang}
              unit={isPercent ? pct : undefined}
              error={error ? t(`errors.${error}`) : null}
            />
          </Fragment>
        )
      })}
    </div>
  )
}
