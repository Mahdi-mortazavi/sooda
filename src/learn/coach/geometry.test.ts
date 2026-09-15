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
function expectInsideViewport(result: ReturnType<typeof computeSpotlight>, viewport: Size = PHONE) {
  expect(result.tooltip.x).toBeGreaterThanOrEqual(0)
  expect(result.tooltip.y).toBeGreaterThanOrEqual(0)
  expect(result.tooltip.x + TOOLTIP.width).toBeLessThanOrEqual(viewport.width)
  expect(result.tooltip.y + TOOLTIP.height).toBeLessThanOrEqual(viewport.height)
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
