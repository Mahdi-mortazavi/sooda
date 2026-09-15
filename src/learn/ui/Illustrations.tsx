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

/**
 * Card 2 — «اقساط، کالاها و قیمت‌ها — همه با یک لمس.»
 *
 * Three cards fanned under one tap: the picture is breadth reachable in a single touch, not
 * prices going up. Drawn symmetrically about the vertical axis so nothing has to mirror for RTL.
 */
export function IllustrationEverything({ className = '' }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" fill="none" aria-hidden className={`${BOX} ${className}`}>
      <g stroke="currentColor" strokeWidth="5" strokeLinejoin="round" opacity="0.32">
        <rect x="24" y="34" width="46" height="60" rx="12" />
        <rect x="130" y="34" width="46" height="60" rx="12" />
      </g>
      <rect x="72" y="24" width="56" height="70" rx="14" fill="var(--accent-fill-strong)" opacity="0.14" />
      <rect x="72" y="24" width="56" height="70" rx="14" stroke="var(--accent-fill-strong)" strokeWidth="5" />
      {/* the three things: a coin, a box and a receipt line */}
      <circle cx="100" cy="46" r="7" fill="var(--accent-fill-strong)" />
      <path d="M88 64h24M88 76h16" stroke="var(--accent-fill-strong)" strokeWidth="5" strokeLinecap="round" />
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.32">
        <path d="M36 54h22M36 66h14M142 54h22M142 66h14" />
      </g>
      {/* one finger, on the middle card */}
      <circle cx="100" cy="106" r="10" fill="var(--accent-fill-strong)" opacity="0.2" />
      <circle cx="100" cy="106" r="5" fill="var(--accent-fill-strong)" />
    </svg>
  )
}

/**
 * Card 3 — «رایگان، بدون ثبت‌نام، آفلاین. اعداد شما فقط روی گوشی خودتان می‌ماند.»
 *
 * A phone holding its own figures behind a closed padlock, with the cloud struck through: the
 * claim is privacy and working offline, so the picture has to say where the numbers are *not*
 * going as plainly as where they are.
 */
export function IllustrationPrivate({ className = '' }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 132" fill="none" aria-hidden className={`${BOX} ${className}`}>
      <rect x="66" y="16" width="68" height="100" rx="16" stroke="var(--accent-fill-strong)" strokeWidth="5" />
      <rect x="66" y="16" width="68" height="100" rx="16" fill="var(--accent-fill-strong)" opacity="0.1" />
      {/* the shopkeeper's figures, staying put */}
      <g stroke="var(--accent-fill-strong)" strokeWidth="5" strokeLinecap="round" opacity="0.55">
        <path d="M82 40h30M82 52h22" />
      </g>
      {/* a closed padlock */}
      <rect x="86" y="74" width="28" height="22" rx="6" fill="var(--accent-fill-strong)" />
      <path d="M92 74v-6a8 8 0 0 1 16 0v6" stroke="var(--accent-fill-strong)" strokeWidth="5" />
      {/* the cloud it never reaches */}
      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
        <path d="M18 48h22a11 11 0 0 0 0-22 15 15 0 0 0-28-4 9 9 0 0 0 1 26h5" />
        <path d="m14 22 32 32" />
      </g>
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

/**
 * A mortar board, for the rows and cards that stand for the tutorial itself.
 *
 * It lives here rather than in `components/Icons.tsx` because that module is in the entry chunk:
 * an icon only lazy surfaces draw would be bytes on the critical path for a shopkeeper who never
 * opens a lesson.
 */
export function IconGraduation({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5" />
      <path d="M21 9.5V15" />
    </svg>
  )
}
