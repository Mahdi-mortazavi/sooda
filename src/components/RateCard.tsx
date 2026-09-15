import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import { formatNumber, parseAmount, type AppLanguage } from '../lib/numbers'
import { categoryLabelKey, type CategoryId, type ImportDependency } from '../lib/rates/categories'
import type { Confidence, ProductRate } from '../lib/rates'
import { ConfidenceDots } from './ConfidenceDots'
import { IconAlert, IconCheck, IconTrendUp } from './Icons'
import { NumberField } from './NumberField'
import { Sparkline } from './Sparkline'

/** The presets the manual editor offers before falling back to a typed value. */
const MANUAL_PRESETS = [1, 2, 3, 5, 8]

const CONFIDENCE_KEY: Record<Confidence, string> = {
  low: 'rate.confidenceLow',
  medium: 'rate.confidenceMedium',
  high: 'rate.confidenceHigh',
}

interface RateCardProps {
  rate: ProductRate
  /** Recorded costs in chronological order, for the sparkline and the "why" count. */
  history: number[]
  category: CategoryId
  importDependency: ImportDependency
  lang: AppLanguage
  /** How far the dollar has moved since the last recorded purchase, when that is known. */
  fxChangePercent?: number | null
  /** null puts the product back on the automatic estimate. */
  onManualChange: (monthlyPercent: number | null) => void
}

/**
 * "Why is it this number?" made answerable. The rate is never just asserted: the card
 * shows how much of it came from the shopkeeper's own prices versus the national figures,
 * and always labels itself an estimate.
 */
export function RateCard({
  rate,
  history,
  category,
  importDependency,
  lang,
  fxChangePercent,
  onManualChange,
}: RateCardProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [whyOpen, setWhyOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [custom, setCustom] = useState('')

  const pct = t('fields.percentUnit')
  const percent = `${formatNumber(rate.monthlyPercent, lang)}${pct}`
  const categoryLabel = t(categoryLabelKey(category))

  // Each signal's share of the blend — the same arithmetic the estimate itself used.
  const personalShare = rate.lambda * 100
  const categoryShare = (1 - rate.lambda) * (1 - importDependency) * 100

  const sourceTag = rate.manual
    ? t('rate.manual')
    : buildSourceTag(t, rate.used, categoryLabel)

  const commitCustom = () => {
    const parsed = parseAmount(custom)
    // A rate at or below −100%/month has no logarithm; the engine would ignore it anyway.
    if (!Number.isFinite(parsed) || parsed <= -100) return
    vibrate()
    onManualChange(parsed)
    setEditing(false)
    setCustom('')
  }

  return (
    <section className="glass glass-ring rounded-3xl p-4" aria-label={t('rate.why')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold leading-snug">{t('rate.headline', { percent })}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--text-secondary)]">
            <ConfidenceDots
              value={rate.confidence}
              label={t(CONFIDENCE_KEY[rate.confidence])}
              className="text-[var(--accent-text)]"
            />
            <span>{sourceTag}</span>
          </p>
        </div>
        {history.length > 1 && (
          <Sparkline
            values={history}
            label={t('rate.sparkline')}
            className="mt-0.5 shrink-0 text-[var(--accent-text)]"
          />
        )}
      </div>

      {rate.clamped && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          <IconAlert size={15} className="mt-px shrink-0" />
          {t('rate.clamped')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            vibrate()
            setWhyOpen((open) => !open)
          }}
          aria-expanded={whyOpen}
          className="rounded-full bg-accent-500/12 px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-text)] transition-colors hover:bg-accent-500/20"
        >
          {t('rate.why')}
        </button>
        {rate.manual ? (
          <button
            type="button"
            onClick={() => {
              vibrate()
              onManualChange(null)
            }}
            className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            {t('rate.backToAuto')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              vibrate()
              setEditing((open) => !open)
            }}
            aria-expanded={editing}
            className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            {t('rate.editManual')}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {whyOpen && (
          <Reveal key="why" reducedMotion={!!reducedMotion}>
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-[var(--separator)] pt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {rate.used.personal && (
                <li>
                  {t('rate.whyPersonal', {
                    percent: `${formatNumber(personalShare, lang, 0)}${pct}`,
                    n: formatNumber(history.length, lang, 0),
                  })}
                </li>
              )}
              {rate.used.category && (
                <li>
                  {t('rate.whyCategory', {
                    percent: `${formatNumber(categoryShare, lang, 0)}${pct}`,
                    category: categoryLabel,
                  })}
                </li>
              )}
              {rate.used.fx && fxChangePercent !== null && fxChangePercent !== undefined && (
                <li>{t('rate.whyFx', { percent: `${formatNumber(fxChangePercent, lang)}${pct}` })}</li>
              )}
              {!rate.used.personal && !rate.used.category && !rate.used.fx && <li>{t('rate.whyNone')}</li>}
              {history.length === 0 && <li>{t('rate.noHistory')}</li>}
            </ul>
            {rate.confidence !== 'high' && !rate.manual && (
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-[var(--accent-text)]">
                <IconTrendUp size={15} className="mt-px shrink-0" />
                {t('rate.improve')}
              </p>
            )}
          </Reveal>
        )}

        {editing && !rate.manual && (
          <Reveal key="manual" reducedMotion={!!reducedMotion}>
            <div className="mt-3 border-t border-[var(--separator)] pt-3">
              <p className="mb-2 text-[13px] font-semibold text-[var(--text-secondary)]">{t('rate.manualTitle')}</p>
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {MANUAL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      vibrate()
                      onManualChange(preset)
                      setEditing(false)
                    }}
                    className="shrink-0 rounded-full bg-accent-500/12 px-3 py-1.5 text-[13.5px] font-semibold text-[var(--accent-text)] transition-colors hover:bg-accent-500/22"
                  >
                    {formatNumber(preset, lang, 0)}
                    {pct}
                  </button>
                ))}
              </div>
              <div className="-mx-4 mt-1 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <NumberField
                    id="rate-manual"
                    label={t('rate.editManual')}
                    value={custom}
                    onChange={setCustom}
                    placeholder={t('fields.percentPlaceholder')}
                    lang={lang}
                    unit={pct}
                  />
                </div>
                <button
                  type="button"
                  onClick={commitCustom}
                  aria-label={t('rate.manualTitle')}
                  className="me-4 mb-3.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-fill-strong)] text-white dark:text-[hsl(168_90%_8%)]"
                >
                  <IconCheck size={18} />
                </button>
              </div>
            </div>
          </Reveal>
        )}
      </AnimatePresence>
    </section>
  )
}

/** "This product + Clothing", "Dollar", "Auto" — whichever signals actually spoke. */
function buildSourceTag(
  t: (key: string, vars?: Record<string, unknown>) => string,
  used: ProductRate['used'],
  categoryLabel: string,
): string {
  const tags: string[] = []
  if (used.personal) tags.push(t('rate.sourceSelf'))
  if (used.category) tags.push(categoryLabel)
  if (used.fx) tags.push(t('rate.sourceFx'))
  const joined = tags.length === 0 ? t('rate.auto') : tags.reduce((a, b) => t('rate.sourceBoth', { a, b }))
  return `${t('rate.auto')} · ${joined}`
}

/** A section that springs open under the card without shifting what is above it. */
function Reveal({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  )
}
