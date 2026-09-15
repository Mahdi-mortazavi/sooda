/**
 * The three intro cards' pictures.
 *
 * Inline SVG, drawn from `currentColor` and the accent variable, so they weigh nothing to fetch,
 * work offline on the very first launch, and follow the theme without a second asset. No raster
 * and no Lottie: the brief rules both out, and an onboarding screen that waits on a download is
 * the first thing a shopkeeper on a 3G phone would see.
 *
 * Every one is symmetrical about its vertical axis or reads as a chart, so nothing here has to
 * mirror under `dir="rtl"` — the same reason the progress ring is a ring.
 */

interface IllustrationProps {
  className?: string
}

const BOX = 'h-[132px] w-full'

/** Card 1 — a price tag with a coin: "what you sell, and what is left of it". */
export function IllustrationPrice({ className = '' }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" fill="none" aria-hidden className={`${BOX} ${className}`}>
      <rect x="28" y="30" width="96" height="72" rx="16" fill="var(--accent-fill-strong)" opacity="0.14" />
      <path
        d="M52 46h34a10 10 0 0 1 7 3l28 28a10 10 0 0 1 0 14l-24 24a10 10 0 0 1-14 0l-28-28a10 10 0 0 1-3-7V54a8 8 0 0 1 8-8Z"
        stroke="var(--accent-fill-strong)"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="64" r="6" fill="var(--accent-fill-strong)" />
      <circle cx="146" cy="76" r="26" stroke="currentColor" strokeWidth="5" opacity="0.4" />
      <path d="M146 62v28M139 69h11a6 6 0 0 1 0 12h-11" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

/** Card 2 — a rising line over bars: "costs move, and your price has to keep up". */
export function IllustrationRise({ className = '' }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" fill="none" aria-hidden className={`${BOX} ${className}`}>
      <g opacity="0.22" fill="currentColor">
        <rect x="34" y="78" width="20" height="28" rx="6" />
        <rect x="66" y="66" width="20" height="40" rx="6" />
        <rect x="98" y="54" width="20" height="52" rx="6" />
        <rect x="130" y="38" width="20" height="68" rx="6" />
      </g>
      <path
        d="M34 84 66 70l32-16 42-26"
        stroke="var(--accent-fill-strong)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M124 26h20v20" stroke="var(--accent-fill-strong)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Card 3 — a hand tapping a card: "you learn it by doing it, on your own screen". */
export function IllustrationPractice({ className = '' }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" fill="none" aria-hidden className={`${BOX} ${className}`}>
      <rect x="46" y="18" width="108" height="72" rx="16" stroke="currentColor" strokeWidth="5" opacity="0.4" />
      <rect x="62" y="36" width="52" height="8" rx="4" fill="currentColor" opacity="0.28" />
      <rect x="62" y="54" width="76" height="8" rx="4" fill="currentColor" opacity="0.18" />
      <circle cx="122" cy="88" r="22" fill="var(--accent-fill-strong)" opacity="0.16" />
      <circle cx="122" cy="88" r="11" fill="var(--accent-fill-strong)" />
      <path
        d="M122 104v14M110 112l12 6 12-6"
        stroke="var(--accent-fill-strong)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The badge shown on the celebration screen and in the centre's mastery header. */
export function BadgeMedal({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} fill="none" aria-hidden>
      <circle cx="28" cy="24" r="16" fill="var(--accent-fill-strong)" opacity="0.18" />
      <circle cx="28" cy="24" r="16" stroke="var(--accent-fill-strong)" strokeWidth="3" />
      <path
        d="m28 15 3.2 6.6 7.3 1-5.3 5.1 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1Z"
        fill="var(--accent-fill-strong)"
      />
      <path
        d="M19 37 15 52l13-6 13 6-4-15"
        stroke="var(--accent-fill-strong)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
