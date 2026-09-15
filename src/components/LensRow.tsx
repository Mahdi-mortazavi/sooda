import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import type { FieldSpec, ModeState } from '../lib/modes/types'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { ChipRow } from './ChipRow'
import { NumberField } from './NumberField'
import { SegmentedControl } from './SegmentedControl'

interface LensRowProps {
  fields: FieldSpec[]
  state: ModeState
  errors: Record<string, ValidationError>
  lang: AppLanguage
  monthlyInflationPercent: number
  onChange: (key: string, value: string) => void
  /** The inflation chip is a shortcut into Settings, where the rate lives. */
  onOpenInflationSetting: () => void
}

/**
 * "When does the money come back?" — the row that turns a plain margin into a real one.
 * With "Now" selected it adds nothing but itself, so existing habits keep working.
 */
export function LensRow({
  fields,
  state,
  errors,
  lang,
  monthlyInflationPercent,
  onChange,
  onOpenInflationSetting,
}: LensRowProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const monthsField = fields.find((f) => f.key === 'months')
  const sourceField = fields.find((f) => f.key === 'src')
  const replacementField = fields.find((f) => f.key === 'replacement')
  if (!monthsField) return null

  const months = state['months'] ?? '0'
  const source = state['src'] ?? 'inflation'
  const expanded = Number(months) > 0
  const monthOptions = (monthsField.options ?? []).map((value, index) => ({
    value,
    label: t(monthsField.optionLabelKeys?.[index] ?? value),
  }))

  return (
    <div className="glass glass-ring rounded-3xl px-5 py-3.5">
      <p className="mb-2 text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">{t('lens.title')}</p>
      <ChipRow
        options={monthOptions}
        value={months}
        onChange={(value) => onChange('months', value)}
        layoutId="lens-months"
        ariaLabel={t('lens.title')}
      />

      <AnimatePresence initial={false}>
        {expanded && sourceField && (
          <motion.div
            key="lens-source"
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <SegmentedControl<string>
                layoutId="lens-source"
                ariaLabel={t('lens.title')}
                value={source}
                onChange={(value) => onChange('src', value)}
                size="sm"
                options={(sourceField.options ?? []).map((value, index) => ({
                  value,
                  label: t(sourceField.optionLabelKeys?.[index] ?? value),
                }))}
              />
            </div>

            {source === 'known' && replacementField ? (
              <div className="-mx-5 mt-1">
                <NumberField
                  id="lens-replacement"
                  label={t(replacementField.labelKey)}
                  value={state['replacement'] ?? ''}
                  onChange={(value) => onChange('replacement', value)}
                  placeholder={t('fields.amountPlaceholder')}
                  lang={lang}
                  error={errors['replacement'] ? t(`errors.${errors['replacement']}`) : null}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenInflationSetting}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-2xl bg-accent-500/12 px-3.5 py-2 text-[13.5px] font-semibold text-[var(--accent-text)] transition-colors hover:bg-accent-500/20"
              >
                {t('lens.inflationChip', {
                  percent: `${formatNumber(monthlyInflationPercent, lang)}${t('fields.percentUnit')}`,
                })}
                {/* Baked into the string it pointed the wrong way in Persian. */}
                <span aria-hidden className="rtl:rotate-180">
                  ›
                </span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
