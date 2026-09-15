/**
 * What every icon is drawn with.
 *
 * Its own module so that `Icons.tsx` and `SheetIcons.tsx` can share it without either pulling the
 * other in — which is the entire point of that split. See `SheetIcons.tsx`.
 */

import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/** The attributes every glyph shares: a 24-unit box, a 1.8 stroke, and no role of its own. */
export function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}
