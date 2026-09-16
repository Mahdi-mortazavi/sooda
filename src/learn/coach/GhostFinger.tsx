import { motion, useReducedMotion } from 'motion/react'
import { useIsRtl } from './useSpotlight'

interface GhostFingerProps {
  /** Fingertip position as an `inset-inline-start` distance — already mirrored by the caller. */
  inlineStart: number
  /** Fingertip position down the block axis, in viewport pixels. */
  top: number
  /** Bumped once per tap so the ripple replays without the finger having to move. */
  tap: number
  /** Hidden until the runner has a first target to point at. */
  visible: boolean
}

/** Roughly a fingertip's worth of ring, and the glyph that sits inside it. */
const RING = 44
const FINGER = 38

/**
 * The «نشانم بده» hand: springs to whatever the demo is about to touch, then taps.
 *
 * Under `prefers-reduced-motion` it does not animate at all — not a shorter spring, none.
 * It becomes a static ring around the target and the runner says in words what it is about
 * to do, because a hand that teleports between controls is worse than no hand.
 */
export function GhostFinger({ inlineStart, top, tap, visible }: GhostFingerProps) {
  const reducedMotion = useReducedMotion()
  const rtl = useIsRtl()
  if (!visible) return null

  const offset = inlineStart - RING / 2
  const blockOffset = top - RING / 2

  if (reducedMotion) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed z-[70] rounded-full ring-[3px] ring-[var(--accent-fill-strong)]"
        style={{ insetInlineStart: offset, insetBlockStart: blockOffset, width: RING, height: RING }}
      />
    )
  }

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[70]"
      /* Anchored at the inline-start corner and moved with a transform, so the spring runs
       * on the compositor instead of re-laying-out every frame. A transform is the one
       * place the inline axis has to be spelled out: `translateX` is rightward-positive
       * whatever the direction, so an RTL page walks the other way along it. */
      style={{ insetInlineStart: 0, insetBlockStart: 0, width: RING, height: RING }}
      initial={false}
      animate={{ x: rtl ? -offset : offset, y: blockOffset }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <motion.span
        key={tap}
        className="absolute inset-0 rounded-full bg-[var(--accent-fill)]/25 ring-2 ring-[var(--accent-fill-strong)]"
        initial={{ scale: 0.55, opacity: 0.9 }}
        animate={{ scale: [0.55, 1, 0.75], opacity: [0.9, 0.35, 0.7] }}
        transition={{ duration: 0.45, times: [0, 0.5, 1] }}
      />
      <motion.svg
        key={`hand-${tap}`}
        viewBox="0 0 24 24"
        width={FINGER}
        height={FINGER}
        className="absolute text-[var(--accent-text)]"
        /* The drawn fingertip sits near (10, 4) in the glyph's own box; the offsets put
         * that point on the ring's centre rather than the glyph's corner. */
        style={{ insetInlineStart: RING / 2 - 9, insetBlockStart: RING / 2 - 5 }}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 0.86, 1] }}
        transition={{ duration: 0.4, times: [0, 0.45, 1] }}
      >
        <path
          d="M10.2 13.1V4.8a1.75 1.75 0 1 1 3.5 0v5.3l4.1 1a2.3 2.3 0 0 1 1.7 2.6l-.5 3.3A4.2 4.2 0 0 1 14.9 21h-2.4a4.2 4.2 0 0 1-3.3-1.6l-3-3.8a1.6 1.6 0 0 1 2.3-2.2Z"
          fill="var(--glass-fill-strong)"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  )
}
