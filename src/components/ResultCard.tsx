import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { formatNumber } from '../lib/numbers'
import type { ResultDisplay } from '../lib/modes/types'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { CountUp } from './CountUp'
import { IconBasketPlus, IconCheck, IconCopy, IconLink } from './Icons'

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
}

export function ResultCard({ result, lang, unit, shareUrl, onAddToBasket }: ResultCardProps) {
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
      className="glass-strong glass-ring relative rounded-3xl p-5"
      aria-label={t('results.title')}
    >
      {!reducedMotion && <RefractionShine />}

      {/* Screen readers announce the final values once, not every animation frame. */}
      <div aria-live="polite" role="status" className="sr-only">
        {result.copyText}
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">{result.primaryLabel}</p>
          <p
            className={`mt-0.5 text-[38px] font-bold leading-tight tracking-tight tabular-nums ${
              result.isLoss ? lossClass : 'text-[var(--accent-text)]'
            }`}
          >
            <CountUp value={result.primaryValue} format={fmtPrimary} />
            {result.primaryUnit ? <span className="ms-1 text-[25px] font-semibold">{result.primaryUnit}</span> : null}
          </p>
        </div>
        <div className="mt-1 flex shrink-0 gap-2">
          <motion.button
            type="button"
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

      <div className="relative mt-4 border-t border-[var(--separator)] pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">{result.secondaryLabel}</p>
          <p className={`text-[21px] font-bold tabular-nums ${result.isLoss ? lossClass : 'text-[var(--text-primary)]'}`}>
            <CountUp value={result.secondaryValue} format={fmtSecondary} />
            {result.secondaryUnit ? <span className="ms-0.5 text-[15px] font-semibold">{result.secondaryUnit}</span> : null}
          </p>
        </div>
        {result.notice ? (
          <p className={`mt-2 text-[13px] font-semibold ${result.isLoss ? lossClass : 'text-[var(--text-secondary)]'}`}>
            {result.notice}
          </p>
        ) : null}
      </div>
    </motion.section>
  )
}
