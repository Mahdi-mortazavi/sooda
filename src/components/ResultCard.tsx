import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { formatNumber } from '../lib/numbers'
import { CountUp } from './CountUp'
import { IconCheck, IconCopy } from './Icons'

export interface ResultDisplay {
  key: string
  primaryLabel: string
  primaryValue: number
  primaryUnit?: string
  secondaryLabel: string
  secondaryValue: number
  secondaryUnit?: string
  isLoss: boolean
  notice?: string
  copyText: string
}

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

export function ResultCard({ result, lang }: { result: ResultDisplay; lang: AppLanguage }) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(copyTimer.current), [])
  useEffect(() => {
    setCopied(false)
  }, [result.key])

  const onCopy = async () => {
    vibrate()
    try {
      await navigator.clipboard.writeText(result.copyText)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard unavailable (permissions/insecure context) — nothing to do.
    }
  }

  const lossClass = 'text-loss-600 dark:text-loss-400'
  const fmt = (v: number) => formatNumber(v, lang)

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
            className={`mt-0.5 truncate text-[40px] font-bold leading-tight tracking-tight tabular-nums ${
              result.isLoss ? lossClass : 'text-[var(--accent-text)]'
            }`}
          >
            <CountUp value={result.primaryValue} format={fmt} />
            {result.primaryUnit ? <span className="ms-1 text-[26px] font-semibold">{result.primaryUnit}</span> : null}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onCopy}
          whileTap={reducedMotion ? undefined : { scale: 0.92 }}
          aria-label={copied ? t('actions.copied') : t('actions.copy')}
          className="glass glass-ring mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)]"
        >
          {copied ? <IconCheck className="text-[var(--accent-text)]" /> : <IconCopy />}
        </motion.button>
      </div>

      <div className="relative mt-4 border-t border-[var(--separator)] pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">{result.secondaryLabel}</p>
          <p className={`text-[22px] font-bold tabular-nums ${result.isLoss ? lossClass : 'text-[var(--text-primary)]'}`}>
            <CountUp value={result.secondaryValue} format={fmt} />
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
