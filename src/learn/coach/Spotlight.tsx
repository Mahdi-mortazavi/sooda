import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { computeSpotlight, type Placement, type Rect, type Size, type SpotlightLayout } from './geometry'
import {
  applyInertOutside,
  focusQuietly,
  useIsRtl,
  useMeasuredSize,
  useSafeArea,
  useSpotlightTarget,
  useViewportSize,
} from './useSpotlight'

interface SpotlightProps {
  /** The `data-tour` value this step points at. */
  target: string
  placement?: Placement
  /** Changes whenever the step does; drives focus, the announcement and re-measurement. */
  stepId: string
  /** Already-translated body copy. */
  text: string
  /** What a screen reader hears when the step begins, position included. */
  announcement: string
  /** Shown once the runner decides the user is stuck. */
  hint?: string | null
  /** Draws the attention ring around the hole. */
  pulse?: boolean
  /** "۲ از ۵" — pre-formatted by the runner so the digits are localized. */
  counter: string
  skipLabel: string
  onSkip: () => void
  /** Extra footer controls, e.g. «نشانم بده». */
  actions?: ReactNode
  /** The ghost finger, when a demo is playing. */
  children?: ReactNode
}

/** Enough of a guess to place the first frame before the tooltip has been measured. */
const TOOLTIP_GUESS: Size = { width: 288, height: 132 }
/** The least margin the tooltip keeps from the viewport edge, on top of the safe area. */
const EDGE = 12

/**
 * The overlay: a dimmed backdrop with a rounded hole, and a glass tooltip with an arrow.
 *
 * Two separate mechanisms keep the hole usable while the rest of the page is not:
 *
 * * pointers — the dim is painted through an SVG mask and takes no events at all; a second,
 *   unpainted even-odd path swallows everything *outside* the hole, so a tap inside it
 *   lands on the real control underneath;
 * * keyboard and assistive tech — `inert` on every branch of the tree that is not the
 *   target's own ancestry (see `applyInertOutside`).
 */
export function Spotlight({
  target,
  placement = 'auto',
  stepId,
  text,
  announcement,
  hint,
  pulse = false,
  counter,
  skipLabel,
  onSkip,
  actions,
  children,
}: SpotlightProps) {
  const reducedMotion = useReducedMotion()
  const rtl = useIsRtl()
  const viewport = useViewportSize()
  const safeArea = useSafeArea()
  const { element, rect } = useSpotlightTarget(target)

  const overlayRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipSize = useMeasuredSize(tooltipRef, `${stepId}:${text}:${hint ?? ''}`, TOOLTIP_GUESS)

  const layout = useMemo(
    () =>
      computeSpotlight({
        target: rect ?? offscreen(viewport),
        tooltip: tooltipSize,
        viewport,
        placement,
        dir: rtl ? 'rtl' : 'ltr',
        insets: {
          top: safeArea.top + EDGE,
          bottom: safeArea.bottom + EDGE,
          // The browser only names the safe area physically; this is where it becomes logical.
          start: (rtl ? safeArea.right : safeArea.left) + EDGE,
          end: (rtl ? safeArea.left : safeArea.right) + EDGE,
        },
      }),
    [rect, tooltipSize, viewport, placement, rtl, safeArea],
  )

  /* Focus is captured once, when the lesson starts, and handed back when it ends — the
   * per-step moves below never touch it. */
  useEffect(() => {
    const previouslyFocused = document.activeElement
    return () => {
      focusQuietly(previouslyFocused instanceof HTMLElement ? previouslyFocused : null)
    }
  }, [])

  /* Re-applied per step: the branch that must stay reachable moves with the target. */
  useLayoutEffect(() => applyInertOutside(element, [overlayRef.current]), [element, stepId])

  // The tooltip takes focus on every step so the copy is read and the controls are one Tab away.
  useEffect(() => {
    focusQuietly(tooltipRef.current)
  }, [stepId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onSkip()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onSkip])

  const safeId = stepId.replace(/[^a-zA-Z0-9_-]/g, '')
  const maskId = `sooda-spot-${safeId}`
  const textId = `sooda-spot-text-${safeId}`
  const hasHole = layout.cutout.width > 0 && layout.cutout.height > 0

  return createPortal(
    <div ref={overlayRef} className="pointer-events-none fixed inset-0 z-[60]">
      {/* Read on every step, and the only thing here a screen reader is told about twice. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <svg
        aria-hidden
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        className="fixed inset-0"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id={maskId}>
            <rect x={0} y={0} width={viewport.width} height={viewport.height} fill="white" />
            {hasHole && (
              <rect
                x={layout.cutout.x}
                y={layout.cutout.y}
                width={layout.cutout.width}
                height={layout.cutout.height}
                rx={layout.cutoutRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={viewport.width}
          height={viewport.height}
          mask={`url(#${maskId})`}
          className="fill-black/45 dark:fill-black/65"
        />
        {hasHole && <CutoutRing rect={layout.cutout} radius={layout.cutoutRadius} pulse={pulse} />}
        {/*
         * The blocker. Unpainted, so it changes nothing on screen, but `pointer-events: fill`
         * hit-tests its even-odd fill region anyway: everything but the hole. Masking alone
         * would not do this — a masked-out region's hit behaviour is not reliable across
         * engines, and this has to be exactly right or the lesson stops working.
         */}
        <path
          d={blockerPath(viewport, hasHole ? layout.cutout : null, layout.cutoutRadius)}
          fillRule="evenodd"
          fill="transparent"
          style={{ pointerEvents: 'fill' }}
        />
      </svg>

      <motion.div
        ref={tooltipRef}
        role="dialog"
        /* Named by the position and described by the copy, so focusing it does not read the
         * same sentence the live region above has just announced. */
        aria-label={counter}
        aria-describedby={textId}
        tabIndex={-1}
        /* `key` on the step so the tooltip re-enters rather than sliding between targets —
         * a tooltip that flies across the screen is hard to follow and easy to lose. */
        key={stepId}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
        className="glass-strong glass-ring pointer-events-auto fixed w-max max-w-[min(20rem,calc(100vw-1.5rem))] rounded-[22px] p-4 text-start outline-none"
        style={{ insetInlineStart: layout.tooltip.inlineStart, insetBlockStart: layout.tooltip.y }}
      >
        {layout.fits && (
          <span
            aria-hidden
            className="glass-ring absolute h-3 w-3 rotate-45 rounded-[3px] bg-[var(--glass-fill-strong)]"
            style={arrowStyle(layout)}
          />
        )}

        <p id={textId} className="text-[15px] font-semibold leading-relaxed">{text}</p>

        <AnimatePresence initial={false}>
          {hint ? (
            <motion.p
              key="hint"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="overflow-hidden text-[13.5px] leading-snug text-[var(--text-secondary)]"
            >
              <span className="mt-2 block">{hint}</span>
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12.5px] font-semibold tabular-nums text-[var(--text-tertiary)]">{counter}</span>
          <span className="flex-1" />
          {actions}
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full bg-black/8 px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/12 dark:bg-white/12 dark:hover:bg-white/18"
          >
            {skipLabel}
          </button>
        </div>
      </motion.div>

      {children}
    </div>,
    document.body,
  )
}

/**
 * The arrow pins to whichever of the tooltip's four edges faces the hole, and slides along
 * that edge to aim at it. Every offset is logical, so `start` and `end` swap sides under RTL
 * with nothing here having to know that they did.
 */
function arrowStyle(layout: SpotlightLayout): CSSProperties {
  const nudge = -6
  switch (layout.placement) {
    case 'bottom':
      return { insetInlineStart: layout.arrowInlineStart + nudge, insetBlockStart: nudge }
    case 'top':
      return { insetInlineStart: layout.arrowInlineStart + nudge, insetBlockEnd: nudge }
    case 'end':
      // The tooltip sits after the hole, so its arrow leans back towards the start.
      return { insetBlockStart: layout.arrowBlockStart + nudge, insetInlineStart: nudge }
    default:
      return { insetBlockStart: layout.arrowBlockStart + nudge, insetInlineEnd: nudge }
  }
}

/** The ring that gives the hole an edge, and pulses when the runner thinks the user is lost. */
function CutoutRing({ rect, radius, pulse }: { rect: Rect; radius: number; pulse: boolean }) {
  const reducedMotion = useReducedMotion()
  const animate = pulse && !reducedMotion
  return (
    <motion.rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      rx={radius}
      fill="none"
      stroke="var(--accent-fill-strong)"
      strokeWidth={pulse ? 2.5 : 1.5}
      initial={false}
      animate={animate ? { opacity: [0.95, 0.3, 0.95] } : { opacity: pulse ? 0.95 : 0.7 }}
      transition={animate ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      style={{ pointerEvents: 'none' }}
    />
  )
}

/** Viewport rectangle with the hole subtracted, as one even-odd path. */
function blockerPath(viewport: Size, cutout: Rect | null, radius: number): string {
  const outer = `M0 0H${viewport.width}V${viewport.height}H0Z`
  if (!cutout) return outer
  const r = Math.max(0, Math.min(radius, cutout.width / 2, cutout.height / 2))
  const { x, y, width: w, height: h } = cutout
  const inner =
    `M${x + r} ${y}` +
    `h${w - r * 2}a${r} ${r} 0 0 1 ${r} ${r}` +
    `v${h - r * 2}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-(w - r * 2)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
    `v${-(h - r * 2)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  return `${outer}${inner}`
}

/**
 * Where to pretend the target is while it is still being looked for: just off the bottom,
 * so the tooltip settles low rather than jumping in from a corner when the real rect lands.
 */
function offscreen(viewport: Size): Rect {
  return { x: viewport.width / 2, y: viewport.height, width: 0, height: 0 }
}
