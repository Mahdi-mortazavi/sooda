import type { Confidence } from '../lib/rates/confidence'

const FILLED: Record<Confidence, number> = { low: 1, medium: 2, high: 3 }

interface ConfidenceDotsProps {
  value: Confidence
  /** Spoken description, e.g. "estimate quality: medium" — the dots alone say nothing. */
  label: string
  className?: string
}

/** ●○○ / ●●○ / ●●● — how much Sooda trusts its own estimate. */
export function ConfidenceDots({ value, label, className = '' }: ConfidenceDotsProps) {
  const filled = FILLED[value]
  return (
    <span role="img" aria-label={label} className={`inline-flex items-center gap-[3px] ${className}`}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden
          className={`block h-[5px] w-[5px] rounded-full ${
            index < filled ? 'bg-current' : 'bg-current opacity-25'
          }`}
        />
      ))}
    </span>
  )
}
