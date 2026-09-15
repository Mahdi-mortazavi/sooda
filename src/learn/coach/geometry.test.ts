import { describe, expect, it } from 'vitest'
import { computeSpotlight, SPOTLIGHT_DEFAULTS, type Rect, type Size, type SpotlightInput } from './geometry'

/** The narrowest phone the brief asks for, at a plausible height. */
const PHONE: Size = { width: 360, height: 640 }
const TOOLTIP: Size = { width: 280, height: 120 }
const EDGE = SPOTLIGHT_DEFAULTS.edge
const GAP = SPOTLIGHT_DEFAULTS.gap
const PAD = SPOTLIGHT_DEFAULTS.padding

function layout(over: Partial<SpotlightInput> & { target: Rect }) {
  return computeSpotlight({ tooltip: TOOLTIP, viewport: PHONE, ...over })
}

/** Every layout must satisfy this, whatever nonsense went in. */
function expectInsideViewport(
  result: ReturnType<typeof computeSpotlight>,
  viewport: Size = PHONE,
  tooltip: Size = TOOLTIP,
) {
  expect(result.tooltip.x).toBeGreaterThanOrEqual(0)
  expect(result.tooltip.y).toBeGreaterThanOrEqual(0)
  expect(result.tooltip.x + tooltip.width).toBeLessThanOrEqual(viewport.width)
  expect(result.tooltip.y + tooltip.height).toBeLessThanOrEqual(viewport.height)
}

describe('computeSpotlight — the hole', () => {
  it('pads the target', () => {
    const { cutout } = layout({ target: { x: 40, y: 200, width: 120, height: 48 } })
    expect(cutout).toEqual({ x: 40 - PAD, y: 200 - PAD, width: 120 + PAD * 2, height: 48 + PAD * 2 })
  })

  it('rounds a short target to half its height so it reads as a pill', () => {
    const { cutoutRadius } = layout({ target: { x: 40, y: 200, width: 120, height: 20 } })
    expect(cutoutRadius).toBe((20 + PAD * 2) / 2)
  })

  it('caps the radius so a tall target does not become a pill', () => {
    const { cutoutRadius } = layout({ target: { x: 40, y: 100, width: 200, height: 300 } })
    expect(cutoutRadius).toBe(SPOTLIGHT_DEFAULTS.maxCutoutRadius)
  })

  it('gives a zero-size target a findable ring, centred on the point', () => {
    const { cutout } = layout({ target: { x: 180, y: 320, width: 0, height: 0 } })
    expect(cutout.width).toBe(SPOTLIGHT_DEFAULTS.minCutout)
    expect(cutout.height).toBe(SPOTLIGHT_DEFAULTS.minCutout)
    expect(cutout.x + cutout.width / 2).toBe(180)
    expect(cutout.y + cutout.height / 2).toBe(320)
  })

  it('still lays a zero-size target out sanely in the corner', () => {
    const result = layout({ target: { x: 0, y: 0, width: 0, height: 0 } })
    expect(result.cutout.x).toBe(0)
    expect(result.cutout.y).toBe(0)
    // Grown about its centre it would hang off two edges; trimmed, it keeps half its size.
    expect(result.cutout.width).toBe(SPOTLIGHT_DEFAULTS.minCutout / 2)
    expect(result.placement).toBe('bottom')
    expectInsideViewport(result)
  })

  it('trims a target larger than the viewport down to what is visible', () => {
    const { cutout } = layout({ target: { x: -200, y: -300, width: 900, height: 1400 } })
    expect(cutout).toEqual({ x: 0, y: 0, width: PHONE.width, height: PHONE.height })
  })
})

describe('computeSpotlight — flipping', () => {
  it('sits below a target by default when there is room', () => {
    const result = layout({ target: { x: 40, y: 80, width: 120, height: 48 } })
    expect(result.placement).toBe('bottom')
    expect(result.tooltip.y).toBe(80 - PAD + 48 + PAD * 2 + GAP)
    expect(result.fits).toBe(true)
  })

  it('flips above when the target is near the bottom edge', () => {
    const result = layout({ target: { x: 40, y: 560, width: 120, height: 48 } })
    expect(result.placement).toBe('top')
    expect(result.tooltip.y).toBe(560 - PAD - GAP - TOOLTIP.height)
    expectInsideViewport(result)
  })

  it('flips an explicit top request down when the target is near the top edge', () => {
    const result = layout({ target: { x: 40, y: 24, width: 120, height: 44 }, placement: 'top' })
    expect(result.placement).toBe('bottom')
    expectInsideViewport(result)
  })

  it('honours an explicit top request when it fits', () => {
    const result = layout({ target: { x: 40, y: 400, width: 120, height: 44 }, placement: 'top' })
    expect(result.placement).toBe('top')
  })

  it('picks the roomier side and reports a miss when neither side fits', () => {
    const result = layout({ target: { x: 20, y: 40, width: 320, height: 540 } })
    expect(result.fits).toBe(false)
    expectInsideViewport(result)
  })

  it('keeps the tooltip on screen for a target that fills the viewport', () => {
    const result = layout({ target: { x: -200, y: -300, width: 900, height: 1400 } })
    expect(result.fits).toBe(false)
    expectInsideViewport(result)
    // Nowhere to stand: it settles against the trailing edge rather than mid-screen.
    expect(result.tooltip.y).toBe(PHONE.height - EDGE - TOOLTIP.height)
  })
})

describe('computeSpotlight — clamping across the inline axis', () => {
  it('aligns the tooltip to the start edge of the hole in LTR', () => {
    const result = layout({ target: { x: 60, y: 300, width: 40, height: 40 } })
    expect(result.tooltip.x).toBe(60 - PAD)
    expect(result.tooltip.inlineStart).toBe(60 - PAD)
  })

  it('clamps at the start inset rather than hanging off the leading edge', () => {
    const result = layout({ target: { x: 2, y: 300, width: 40, height: 40 } })
    expect(result.tooltip.x).toBe(EDGE)
    expectInsideViewport(result)
  })

  it('clamps at the trailing inset for a target near the end of the row', () => {
    const result = layout({ target: { x: 310, y: 300, width: 40, height: 40 } })
    expect(result.tooltip.x).toBe(PHONE.width - EDGE - TOOLTIP.width)
    expectInsideViewport(result)
  })

  it('pins a tooltip wider than the viewport to the leading inset instead of inverting', () => {
    const wide: Size = { width: 400, height: 100 }
    const result = computeSpotlight({
      target: { x: 100, y: 300, width: 40, height: 40 },
      tooltip: wide,
      viewport: PHONE,
    })
    expect(result.tooltip.x).toBe(EDGE)
    expect(result.arrowInlineStart).toBeGreaterThanOrEqual(0)
    expect(result.arrowInlineStart).toBeLessThanOrEqual(wide.width)
  })
})

describe('computeSpotlight — RTL', () => {
  it('hangs the tooltip off the end edge of the hole', () => {
    const target: Rect = { x: 220, y: 300, width: 100, height: 40 }
    const result = layout({ target, dir: 'rtl' })
    expect(result.tooltip.x).toBe(target.x + target.width + PAD - TOOLTIP.width)
    expect(result.tooltip.inlineStart).toBe(PHONE.width - (target.x + target.width + PAD))
  })

  it('mirrors a mirrored target: the same logical offsets come back out', () => {
    const ltr = layout({ target: { x: 60, y: 300, width: 100, height: 40 } })
    // The same control, laid out in a mirrored page: its right edge is where its left was.
    const mirroredX = PHONE.width - (60 + 100)
    const rtl = layout({ target: { x: mirroredX, y: 300, width: 100, height: 40 }, dir: 'rtl' })
    expect(rtl.tooltip.inlineStart).toBe(ltr.tooltip.inlineStart)
    expect(rtl.arrowInlineStart).toBe(ltr.arrowInlineStart)
    expect(rtl.placement).toBe(ltr.placement)
    expect(rtl.tooltip.y).toBe(ltr.tooltip.y)
  })

  it('clamps against the leading edge, which under RTL is the right-hand one', () => {
    const result = layout({ target: { x: 300, y: 300, width: 56, height: 40 }, dir: 'rtl' })
    expect(result.tooltip.x + TOOLTIP.width).toBe(PHONE.width - EDGE)
    expect(result.tooltip.inlineStart).toBe(EDGE)
  })

  it('clamps against the trailing edge for a target at the far end of an RTL row', () => {
    const result = layout({ target: { x: 4, y: 300, width: 56, height: 40 }, dir: 'rtl' })
    expect(result.tooltip.x).toBe(EDGE)
    expectInsideViewport(result)
  })

  it('applies safe-area insets on the correct physical side', () => {
    const insets = { top: 47, bottom: 34, start: 44, end: 0 }
    const ltr = layout({ target: { x: 0, y: 300, width: 40, height: 40 }, insets })
    expect(ltr.tooltip.x).toBe(44)
    const rtl = layout({ target: { x: 320, y: 300, width: 40, height: 40 }, dir: 'rtl', insets })
    expect(rtl.tooltip.x + TOOLTIP.width).toBe(PHONE.width - 44)
  })
})

describe('computeSpotlight — inline placement, for a chip in a row', () => {
  /** A chip: short and not very wide, with room on both sides. */
  const CHIP: Rect = { x: 150, y: 300, width: 60, height: 34 }
  /** Narrow enough to actually fit beside a chip on a 360px screen — 118px of room either side. */
  const NARROW: Size = { width: 110, height: 90 }

  function beside(over: Partial<SpotlightInput> & { target: Rect }) {
    return computeSpotlight({ tooltip: NARROW, viewport: PHONE, ...over })
  }

  it('sits before the hole in LTR and after it in RTL', () => {
    const ltr = beside({ target: CHIP, placement: 'start' })
    expect(ltr.placement).toBe('start')
    expect(ltr.tooltip.x + NARROW.width).toBe(CHIP.x - PAD - GAP)

    const rtl = beside({ target: CHIP, placement: 'start', dir: 'rtl' })
    expect(rtl.placement).toBe('start')
    expect(rtl.tooltip.x).toBe(CHIP.x + CHIP.width + PAD + GAP)
  })

  it('puts end on the opposite side, in both directions', () => {
    const ltr = beside({ target: CHIP, placement: 'end' })
    expect(ltr.tooltip.x).toBe(CHIP.x + CHIP.width + PAD + GAP)
    const rtl = beside({ target: CHIP, placement: 'end', dir: 'rtl' })
    expect(rtl.tooltip.x + NARROW.width).toBe(CHIP.x - PAD - GAP)
  })

  it('mirrors a mirrored chip: the same logical offsets come back out', () => {
    const ltr = beside({ target: CHIP, placement: 'start' })
    const mirrored: Rect = { ...CHIP, x: PHONE.width - (CHIP.x + CHIP.width) }
    const rtl = beside({ target: mirrored, placement: 'start', dir: 'rtl' })
    expect(rtl.placement).toBe(ltr.placement)
    expect(rtl.tooltip.inlineStart).toBe(ltr.tooltip.inlineStart)
    expect(rtl.arrowBlockStart).toBe(ltr.arrowBlockStart)
    expect(rtl.tooltip.y).toBe(ltr.tooltip.y)
  })

  it('flips start to end at the leading edge of the row', () => {
    const first: Rect = { x: 8, y: 300, width: 60, height: 34 }
    const ltr = beside({ target: first, placement: 'start' })
    expect(ltr.placement).toBe('end')
    expectInsideViewport(ltr, PHONE, NARROW)

    // The same chip at the leading edge of a mirrored row is the one on the right.
    const firstRtl: Rect = { ...first, x: PHONE.width - 68 }
    const rtl = beside({ target: firstRtl, placement: 'start', dir: 'rtl' })
    expect(rtl.placement).toBe('end')
    expectInsideViewport(rtl, PHONE, NARROW)
  })

  it('flips end to start at the trailing edge of the row', () => {
    const last: Rect = { x: PHONE.width - 68, y: 300, width: 60, height: 34 }
    const result = beside({ target: last, placement: 'end' })
    expect(result.placement).toBe('start')
    expectInsideViewport(result, PHONE, NARROW)
  })

  it('stays on its own axis when neither side fits, and says so', () => {
    // A wide target leaves no room either side; flipping to the block axis is not the
    // author's intent, so it squeezes in beside rather than jumping above.
    const wideTarget: Rect = { x: 20, y: 300, width: 320, height: 34 }
    const result = beside({ target: wideTarget, placement: 'start' })
    expect(result.placement === 'start' || result.placement === 'end').toBe(true)
    expect(result.fits).toBe(false)
    expectInsideViewport(result, PHONE, NARROW)
  })

  it('lines its block-start edge up with the hole, and clamps near the bottom', () => {
    const high = beside({ target: CHIP, placement: 'end' })
    expect(high.tooltip.y).toBe(CHIP.y - PAD)

    const low = beside({ target: { ...CHIP, y: 610 }, placement: 'end' })
    expect(low.tooltip.y).toBe(PHONE.height - EDGE - NARROW.height)
    expectInsideViewport(low, PHONE, NARROW)
  })

  it('aims the arrow at the middle of the hole down the block axis', () => {
    const result = beside({ target: CHIP, placement: 'end' })
    expect(result.tooltip.y + result.arrowBlockStart).toBe(CHIP.y + CHIP.height / 2)
  })

  it('keeps the arrow off the tooltip corners for a chip at the very bottom', () => {
    const result = beside({ target: { ...CHIP, y: 620 }, placement: 'end' })
    expect(result.arrowBlockStart).toBeGreaterThanOrEqual(0)
    expect(result.arrowBlockStart).toBeLessThanOrEqual(NARROW.height)
  })

  it('stays inside the viewport for every chip position, both directions and both sides', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (const placement of ['start', 'end'] as const) {
        for (let x = -40; x <= PHONE.width + 40; x += 19) {
          for (let y = -40; y <= PHONE.height + 40; y += 41) {
            const result = beside({ target: { x, y, width: 60, height: 34 }, dir, placement })
            expectInsideViewport(result, PHONE, NARROW)
            expect(result.arrowBlockStart).toBeGreaterThanOrEqual(0)
            expect(result.arrowBlockStart).toBeLessThanOrEqual(NARROW.height)
          }
        }
      }
    }
  })
})

describe('computeSpotlight — the arrow', () => {
  it('aims at the centre of the hole', () => {
    const result = layout({ target: { x: 100, y: 300, width: 60, height: 40 } })
    expect(result.tooltip.x + result.arrowInlineStart).toBe(130)
  })

  it('stops short of the corners when the hole is off to one side', () => {
    const result = layout({ target: { x: 4, y: 300, width: 20, height: 20 } })
    expect(result.arrowInlineStart).toBe(SPOTLIGHT_DEFAULTS.arrowInset)
  })

  it('stays inside the tooltip for every target across the screen, both directions', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (let x = -80; x <= PHONE.width + 80; x += 17) {
        for (let y = -80; y <= PHONE.height + 80; y += 37) {
          const result = layout({ target: { x, y, width: 44, height: 44 }, dir })
          expect(result.arrowInlineStart).toBeGreaterThanOrEqual(0)
          expect(result.arrowInlineStart).toBeLessThanOrEqual(TOOLTIP.width)
          expectInsideViewport(result)
        }
      }
    }
  })
})

describe('computeSpotlight — degenerate input', () => {
  it('survives a viewport smaller than the tooltip', () => {
    const tiny: Size = { width: 200, height: 90 }
    const result = computeSpotlight({
      target: { x: 10, y: 10, width: 40, height: 40 },
      tooltip: TOOLTIP,
      viewport: tiny,
    })
    expect(result.tooltip.x).toBe(EDGE)
    expect(result.tooltip.y).toBe(EDGE)
    expect(result.fits).toBe(false)
  })

  it('keeps the hole inside the viewport for a target scrolled off the bottom', () => {
    const { cutout } = layout({ target: { x: 40, y: 900, width: 100, height: 40 } })
    expect(cutout.y).toBe(PHONE.height)
    expect(cutout.height).toBe(0)
  })
})
