/**
 * How far through the eight lessons the shopkeeper is, as a ring.
 *
 * Inline SVG with no raster and no library: a stroked circle whose dash offset is the progress.
 * `transform` rotates it to start at the top; the ring is symmetrical, so nothing about it needs
 * to mirror for Persian — which is exactly why a ring was chosen over a bar here.
 */

import { useReducedMotion } from 'motion/react'
import { formatNumber, type AppLanguage } from '../../lib/numbers'

interface ProgressRingProps {
  done: number
  total: number
  lang: AppLanguage
  size?: number
  /** Announced to a screen reader; the digits inside the ring are decorative. */
  label: string
}

export function ProgressRing({ done, total, lang, size = 48, label }: ProgressRingProps) {
  const reducedMotion = useReducedMotion()
  const safeTotal = total > 0 ? total : 1
  const fraction = Math.max(0, Math.min(1, done / safeTotal))
  const stroke = Math.max(3, Math.round(size / 12))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-black/10 dark:text-white/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-fill-strong)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={reducedMotion ? undefined : { transition: 'stroke-dashoffset 420ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span
        aria-hidden
        dir="ltr"
        className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums"
        style={{ fontSize: Math.round(size / 4) }}
      >
        {formatNumber(done, lang, 0)}/{formatNumber(total, lang, 0)}
      </span>
    </div>
  )
}
