/**
 * Spotlight geometry — where the hole goes and where the tooltip goes.
 *
 * Pure numbers on purpose: no React, no `window`, no CSS, so every edge case the overlay
 * has to survive (a target off the bottom of the screen, a target taller than the screen,
 * a button that has not laid out yet, RTL) is reachable from a unit test with plain
 * integers. `useSpotlight` does the measuring; this decides what to do with it.
 *
 * Coordinates in are viewport coordinates — exactly what `getBoundingClientRect` returns —
 * and `x` is the physical left edge, because that is the only dialect SVG and the DOM
 * speak. Everything the component renders with comes back out as a *logical*
 * inline-start distance instead, so no caller ever has to name a side.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** Inline-start/end rather than left/right: `start` is the right-hand edge under RTL. */
export interface Insets {
  top: number
  bottom: number
  start: number
  end: number
}

/**
 * What a step may ask for. Same union as `LessonStep['placement']`.
 *
 * `start` and `end` are logical: `start` puts the tooltip on the side the reading order
 * begins at, which is the left of a chip in English and the right of the same chip in
 * Persian. They exist for wide, short targets in a horizontal row — a chip, a tab — where
 * a tooltip above or below has nothing to point at without covering its neighbours.
 */
export type Placement = 'auto' | 'top' | 'bottom' | 'start' | 'end'
export type ResolvedPlacement = 'top' | 'bottom' | 'start' | 'end'

export interface SpotlightInput {
  /** The measured target, in viewport coordinates. */
  target: Rect
  /** The measured tooltip. Before the first measurement pass a caller may estimate it. */
  tooltip: Size
  viewport: Size
  placement?: Placement
  dir?: 'ltr' | 'rtl'
  /** Breathing room between the target and the edge of the hole. */
  padding?: number
  /** Distance between the hole and the tooltip — where the arrow lives. */
  gap?: number
  /** Safe-area insets, plus the least margin the tooltip keeps from the viewport edge. */
  insets?: Partial<Insets>
}

export interface SpotlightLayout {
  /** Always inside the viewport, always at least `MIN_CUTOUT` unless the target is off-screen. */
  cutout: Rect
  cutoutRadius: number
  placement: ResolvedPlacement
  tooltip: {
    /** Physical left edge in viewport coordinates — for SVG, and for tests. */
    x: number
    y: number
    /** What `inset-inline-start` takes: distance from the viewport's inline-start edge. */
    inlineStart: number
  }
  /**
   * Arrow centre along each of the tooltip's own axes, measured from its inline-start and
   * block-start edges. A `top`/`bottom` tooltip pins its arrow to a block edge and slides it
   * along `arrowInlineStart`; a `start`/`end` tooltip does the mirror of that. Both are
   * always computed, so the overlay picks rather than recomputes.
   */
  arrowInlineStart: number
  arrowBlockStart: number
  /**
   * False when the tooltip had to be clamped over the hole because neither side had room —
   * a target that fills the screen. The overlay leans on this to drop its arrow.
   */
  fits: boolean
}

const DEFAULT_PADDING = 8
const DEFAULT_GAP = 12
const DEFAULT_EDGE = 12
/** A hairline or not-yet-laid-out target still needs a ring big enough to find. */
const MIN_CUTOUT = 28
const MAX_CUTOUT_RADIUS = 22
/** Keeps the arrow clear of the tooltip's rounded corners. */
const ARROW_INSET = 20

/**
 * A physical span turned into the `inset-inline-start` distance that puts it in the same
 * place. The only conversion in the codebase that needs to know which edge leads, so it
 * lives here rather than being spelled out in every component that positions something.
 */
export function toInlineStart(x: number, width: number, viewportWidth: number, rtl: boolean): number {
  return rtl ? viewportWidth - (x + width) : x
}

/** Degenerate ranges resolve to `min` rather than throwing the layout inside out. */
function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min
  return value < min ? min : value > max ? max : value
}

/**
 * The hole. Grown by `padding`, floored at `MIN_CUTOUT` about the target's own centre so a
 * zero-size target still reads as a ring, then trimmed to the viewport — a target taller
 * than the screen has no outside left to dim, and the tooltip must lay out against what is
 * actually visible rather than against a rect hanging off both ends.
 */
function buildCutout(target: Rect, padding: number, viewport: Size): Rect {
  const width = Math.max(target.width + padding * 2, MIN_CUTOUT)
  const height = Math.max(target.height + padding * 2, MIN_CUTOUT)
  const rawX = target.x + target.width / 2 - width / 2
  const rawY = target.y + target.height / 2 - height / 2
  const left = clamp(rawX, 0, viewport.width)
  const top = clamp(rawY, 0, viewport.height)
  const right = clamp(rawX + width, left, viewport.width)
  const bottom = clamp(rawY + height, top, viewport.height)
  return {
    x: left,
    y: top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  }
}

/**
 * Place the hole and the tooltip. Guarantees, in order of how loudly they fail when broken:
 *
 * 1. the tooltip is inside the viewport, insets included, whatever the target does;
 * 2. placement flips to the opposite side of the same axis when its own side has no room;
 * 3. under RTL the whole thing mirrors — `start` becomes the right-hand side, the tooltip
 *    hangs off the hole's right edge, and it clamps against the right inset first.
 */
export function computeSpotlight(input: SpotlightInput): SpotlightLayout {
  const { target, tooltip, viewport } = input
  const padding = input.padding ?? DEFAULT_PADDING
  const gap = input.gap ?? DEFAULT_GAP
  const rtl = input.dir === 'rtl'
  const insetTop = input.insets?.top ?? DEFAULT_EDGE
  const insetBottom = input.insets?.bottom ?? DEFAULT_EDGE
  const insetStart = input.insets?.start ?? DEFAULT_EDGE
  const insetEnd = input.insets?.end ?? DEFAULT_EDGE

  const cutout = buildCutout(target, padding, viewport)
  const cutoutRadius = Math.max(0, Math.min(MAX_CUTOUT_RADIUS, cutout.width / 2, cutout.height / 2))

  const spaceAbove = cutout.y - insetTop - gap
  const spaceBelow = viewport.height - (cutout.y + cutout.height) - insetBottom - gap
  /* The inline axis is measured logically, so `spaceStart` is room on the left in English
   * and room on the right in Persian — which is the whole point of having these placements. */
  const cutoutInlineStart = toInlineStart(cutout.x, cutout.width, viewport.width, rtl)
  const spaceStart = cutoutInlineStart - insetStart - gap
  const spaceEnd = viewport.width - cutoutInlineStart - cutout.width - insetEnd - gap
  const fitsAbove = tooltip.height <= spaceAbove
  const fitsBelow = tooltip.height <= spaceBelow
  const fitsStart = tooltip.width <= spaceStart
  const fitsEnd = tooltip.width <= spaceEnd

  /* 'auto' prefers below: that is where the hand already is, and it keeps the tooltip out of
   * the notch. An explicit request is honoured whenever it fits and flipped to its opposite
   * when it does not; when neither side of that axis fits, the roomier one loses the least.
   * A request never jumps axis — a step that asked to sit beside a chip would rather be
   * squeezed beside it than land somewhere the author never looked at. */
  const roomierBlock: ResolvedPlacement = spaceBelow >= spaceAbove ? 'bottom' : 'top'
  const roomierInline: ResolvedPlacement = spaceEnd >= spaceStart ? 'end' : 'start'
  const placement: ResolvedPlacement =
    input.placement === 'top'
      ? fitsAbove
        ? 'top'
        : fitsBelow
          ? 'bottom'
          : roomierBlock
      : input.placement === 'start'
        ? fitsStart
          ? 'start'
          : fitsEnd
            ? 'end'
            : roomierInline
        : input.placement === 'end'
          ? fitsEnd
            ? 'end'
            : fitsStart
              ? 'start'
              : roomierInline
          : fitsBelow
            ? 'bottom'
            : fitsAbove
              ? 'top'
              : roomierBlock

  const alongBlock = placement === 'top' || placement === 'bottom'
  const minX = rtl ? insetEnd : insetStart
  const maxX = viewport.width - (rtl ? insetStart : insetEnd) - tooltip.width
  const minY = insetTop
  const maxY = viewport.height - insetBottom - tooltip.height

  /* One rule on both axes: along the axis the tooltip is *not* placed on, it lines its own
   * leading edge up with the hole's, so it reads as belonging to the thing it points at and
   * mirroring is one edge swapped for the other. The arrow below still aims at the centre. */
  let x: number
  let y: number
  if (alongBlock) {
    y = clamp(placement === 'top' ? cutout.y - gap - tooltip.height : cutout.y + cutout.height + gap, minY, maxY)
    x = clamp(rtl ? cutout.x + cutout.width - tooltip.width : cutout.x, minX, maxX)
  } else {
    // `start` is physically before the hole in English and after it in Persian.
    const before = placement === 'start' ? !rtl : rtl
    x = clamp(before ? cutout.x - gap - tooltip.width : cutout.x + cutout.width + gap, minX, maxX)
    y = clamp(cutout.y, minY, maxY)
  }
  const inlineStart = toInlineStart(x, tooltip.width, viewport.width, rtl)

  const inlineReach = Math.min(ARROW_INSET, tooltip.width / 2)
  const arrowX = clamp(cutout.x + cutout.width / 2, x + inlineReach, x + tooltip.width - inlineReach)
  const arrowInlineStart = rtl ? x + tooltip.width - arrowX : arrowX - x

  const blockReach = Math.min(ARROW_INSET, tooltip.height / 2)
  const arrowY = clamp(cutout.y + cutout.height / 2, y + blockReach, y + tooltip.height - blockReach)
  const arrowBlockStart = arrowY - y

  return {
    cutout,
    cutoutRadius,
    placement,
    tooltip: { x, y, inlineStart },
    arrowInlineStart,
    arrowBlockStart,
    fits: alongBlock ? (placement === 'top' ? fitsAbove : fitsBelow) : placement === 'start' ? fitsStart : fitsEnd,
  }
}

/** Exposed for the overlay and the tests so neither has to restate the numbers. */
export const SPOTLIGHT_DEFAULTS = {
  padding: DEFAULT_PADDING,
  gap: DEFAULT_GAP,
  edge: DEFAULT_EDGE,
  minCutout: MIN_CUTOUT,
  maxCutoutRadius: MAX_CUTOUT_RADIUS,
  arrowInset: ARROW_INSET,
} as const
