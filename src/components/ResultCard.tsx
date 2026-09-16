import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import { emitTour } from '../learn/coach/events'
import type { AppLanguage } from '../lib/numbers'
import { formatNumber } from '../lib/numbers'
import type { ProfitStatus } from '../lib/inflation'
import type { LensBlock, ResultDisplay } from '../lib/modes/types'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { CountUp } from './CountUp'
import { IconAlert, IconBasketPlus, IconBookmarkPlus, IconCalendar, IconCheck, IconCopy, IconLink, IconTarget } from './Icons'

/* ResultDisplay is produced by the mode registry's pure `present` functions and only
 * rendered here, so it lives with the other mode types. Re-exported for existing importers. */
export type { ResultDisplay }

/** Subtle SVG refraction shine that sweeps across the glass. */
function RefractionShine() {
  return (
    <>
      <svg aria-hidden className="absolute h-0 w-0">
        <filter id="sooda-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="shine-streak absolute -inset-y-6 w-1/3 opacity-70 dark:opacity-40"
          style={{
            background:
              'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.55) 48%, rgba(255,255,255,0.2) 55%, transparent 80%)',
            filter: 'url(#sooda-refract)',
          }}
        />
      </div>
    </>
  )
}

interface ResultCardProps {
  result: ResultDisplay
  lang: AppLanguage
  unit: Unit
  shareUrl: string | null
  onAddToBasket: () => Promise<void>
  /** Offered only when the mode produced something worth keeping as a product. */
  onSaveProduct?: () => void
  onOpenSchedule?: () => void
}

const STATUS_STYLES: Record<ProfitStatus, { text: string; fill: string }> = {
  healthy: { text: 'text-[var(--accent-text)]', fill: 'bg-accent-500/14' },
  thin: { text: 'text-warn-700 dark:text-warn-400', fill: 'bg-warn-500/18' },
  losing: { text: 'text-loss-700 dark:text-loss-400', fill: 'bg-loss-500/14' },
}

/** Colour alone never carries the verdict — the label and the glyph both say it too. */
function StatusChip({ status, label }: { status: ProfitStatus; label: string }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold ${style.fill} ${style.text}`}
    >
      {status === 'healthy' ? <IconTarget size={14} /> : <IconAlert size={14} />}
      {label}
    </span>
  )
}

export function ResultCard({
  result,
  lang,
  unit,
  shareUrl,
  onAddToBasket,
  onSaveProduct,
  onOpenSchedule,
}: ResultCardProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [basketed, setBasketed] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  const shareTimer = useRef<ReturnType<typeof setTimeout>>()
  const basketTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current)
      clearTimeout(shareTimer.current)
      clearTimeout(basketTimer.current)
    },
    [],
  )
  useEffect(() => {
    setCopied(false)
    setShared(false)
    setBasketed(false)
  }, [result.key])

  const onBasket = async () => {
    vibrate()
    await onAddToBasket()
    setBasketed(true)
    clearTimeout(basketTimer.current)
    basketTimer.current = setTimeout(() => setBasketed(false), 1800)
  }

  const onCopy = async () => {
    vibrate()
    emitTour({ type: 'action', name: 'copy-result' })
    try {
      await navigator.clipboard.writeText(result.copyText)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  }

  const onShare = async () => {
    if (!shareUrl) return
    vibrate()
    emitTour({ type: 'action', name: 'share-link' })
    const payload = { title: 'Sooda', text: result.copyText, url: shareUrl }
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
        await navigator.share(payload)
        return
      }
    } catch {
      // user cancelled the native share sheet, or share failed — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShared(true)
      clearTimeout(shareTimer.current)
      shareTimer.current = setTimeout(() => setShared(false), 1800)
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  }

  const lossClass = 'text-loss-600 dark:text-loss-400'
  // Percent values render plain numbers + sign; money values carry the active unit.
  const fmtPrimary = (v: number) =>
    result.primaryUnit ? formatNumber(v, lang) : formatAmountWithUnit(v, lang, unit)
  const fmtSecondary = (v: number) =>
    result.secondaryUnit ? formatNumber(v, lang) : formatAmountWithUnit(v, lang, unit)

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      data-tour="result-card"
      className="glass-strong glass-ring relative rounded-3xl p-5"
      aria-label={t('results.title')}
    >
      {!reducedMotion && <RefractionShine />}

      {/* Screen readers announce the final values once, not every animation frame. */}
      <div aria-live="polite" role="status" className="sr-only">
        {result.copyText}
        {result.lens ? ` — ${result.lens.explainer}` : ''}
        {result.lens?.notice ? ` ${result.lens.notice}` : ''}
      </div>

      {/* Label and actions share a row; the value gets its own, so a long amount with a
          currency word can never slide underneath the buttons. */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">{result.primaryLabel}</p>
          {result.status && result.statusLabel ? (
            <StatusChip status={result.status} label={result.statusLabel} />
          ) : null}
        </div>
        <div className="mt-1 flex shrink-0 gap-2">
          <motion.button
            type="button"
            data-tour="btn-add-basket"
            onClick={() => void onBasket()}
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
            aria-label={basketed ? t('basket.added') : t('basket.add')}
            title={t('basket.add')}
            className="glass glass-ring flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)]"
          >
            {basketed ? <IconCheck className="text-[var(--accent-text)]" /> : <IconBasketPlus />}
          </motion.button>
          <motion.button
            type="button"
            data-tour="btn-share"
            onClick={() => void onShare()}
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
            aria-label={shared ? t('actions.linkCopied') : t('actions.share')}
            title={t('actions.share')}
            className="glass glass-ring flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)]"
          >
            {shared ? <IconCheck className="text-[var(--accent-text)]" /> : <IconLink />}
          </motion.button>
          <motion.button
            type="button"
            data-tour="btn-copy"
            onClick={() => void onCopy()}
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
            aria-label={copied ? t('actions.copied') : t('actions.copy')}
            title={t('actions.copy')}
            className="glass glass-ring flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)]"
          >
            {copied ? <IconCheck className="text-[var(--accent-text)]" /> : <IconCopy />}
          </motion.button>
        </div>
      </div>

      <p
        className={`relative mt-1 text-[38px] font-bold leading-tight tracking-tight tabular-nums ${
          result.isLoss ? lossClass : 'text-[var(--accent-text)]'
        }`}
      >
        <CountUp value={result.primaryValue} format={fmtPrimary} />
        {result.primaryUnit ? <span className="ms-1 text-[25px] font-semibold">{result.primaryUnit}</span> : null}
      </p>
      {result.exactPrimary ? (
        <p className="relative mt-0.5 text-[12.5px] tabular-nums text-[var(--text-tertiary)]">{result.exactPrimary}</p>
      ) : null}

      <div className="relative mt-4 border-t border-[var(--separator)] pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">{result.secondaryLabel}</p>
          <p
            className={`text-[21px] font-bold tabular-nums ${
              result.isLoss && !result.secondaryNeutral ? lossClass : 'text-[var(--text-primary)]'
            }`}
          >
            <CountUp value={result.secondaryValue} format={fmtSecondary} />
            {result.secondaryUnit ? <span className="ms-0.5 text-[15px] font-semibold">{result.secondaryUnit}</span> : null}
          </p>
        </div>
        {result.extras?.length ? (
          <dl className="mt-3 flex flex-col gap-1.5">
            {result.extras.map((extra) => (
              <div key={extra.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-[13.5px] text-[var(--text-secondary)]">{extra.label}</dt>
                <dd className="text-[14.5px] font-semibold tabular-nums">{extra.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {result.notice ? (
          <p className={`mt-2 text-[13px] font-semibold ${result.isLoss ? lossClass : 'text-[var(--text-secondary)]'}`}>
            {result.notice}
          </p>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {result.lens && (
          <motion.div
            key="lens"
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="relative overflow-hidden"
          >
            <LensBlockView block={result.lens} lang={lang} />
          </motion.div>
        )}
      </AnimatePresence>

      {onSaveProduct && result.product ? (
        <motion.button
          type="button"
          data-tour="btn-save-product"
          onClick={() => {
            vibrate()
            /* Opening the naming sheet, not saving: `action: save-product` is announced by the
               confirm button in that sheet, which is the moment a row actually exists. */
            emitTour({ type: 'sheet:open', sheet: 'save-product' })
            onSaveProduct()
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          className="glass glass-ring relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold text-[var(--accent-text)]"
        >
          <IconBookmarkPlus size={18} />
          {t('products.save')}
        </motion.button>
      ) : null}

      {onOpenSchedule && result.schedule ? (
        <motion.button
          type="button"
          data-tour="btn-schedule"
          onClick={() => {
            vibrate()
            emitTour({ type: 'sheet:open', sheet: 'schedule' })
            onOpenSchedule()
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          className="glass glass-ring relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold text-[var(--accent-text)]"
        >
          <IconCalendar size={18} />
          {t('installment.schedule.open')}
        </motion.button>
      ) : null}
    </motion.section>
  )
}

/** Nominal versus real, and the one sentence that explains the gap. */
function LensBlockView({ block, lang }: { block: LensBlock; lang: AppLanguage }) {
  const { t } = useTranslation()
  const pct = t('fields.percentUnit')
  const statusLabel = t(
    block.status === 'healthy' ? 'lens.statusHealthy' : block.status === 'thin' ? 'lens.statusThin' : 'lens.statusLosing',
  )
  const style = STATUS_STYLES[block.status]

  return (
    <div className="mt-4 border-t border-[var(--separator)] pt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">{t('lens.blockTitle')}</p>
        <StatusChip status={block.status} label={statusLabel} />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[14px] text-[var(--text-secondary)]">{t('lens.nominalProfit')}</span>
        <span className="text-[16px] font-semibold tabular-nums text-[var(--text-secondary)]">
          {formatNumber(block.nominalPercent, lang)}
          {pct}
        </span>
        <span aria-hidden className="text-[var(--text-tertiary)] rtl:rotate-180">
          →
        </span>
        <span className="text-[14px] text-[var(--text-secondary)]">{t('lens.realProfit')}</span>
        <span className={`text-[19px] font-bold tabular-nums ${style.text}`}>
          {formatNumber(block.realPercent, lang)}
          {pct}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{block.explainer}</p>
      {block.notice ? (
        <p className="mt-1.5 text-[13px] font-semibold text-loss-600 dark:text-loss-400">{block.notice}</p>
      ) : null}
    </div>
  )
}
