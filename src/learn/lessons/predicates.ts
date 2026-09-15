/**
 * The small vocabulary every step's `expect` is written in.
 *
 * Steps advance on events, never on timers (plan, D3), and a predicate is read far more often
 * than it is written — so they are named for what the user did, not for the event shape. Each
 * one ignores `state`; the two predicates that do read the practice store live with their lesson,
 * where the reason they need it is in view.
 */

import type { TourEvent } from '../coach/events'

type Predicate = (ev: TourEvent) => boolean

/** A money or percent field was committed — optionally, with exactly this value. */
export function committed(field: string, value?: number): Predicate {
  return (ev) => ev.type === 'field:commit' && ev.field === field && (value === undefined || ev.value === value)
}

/**
 * A chip or toggle option was chosen.
 *
 * Toggles are chips with two options, and whether `ui` announces one as `chip:select` or as a
 * `field:change` is its business; both are accepted so a lesson cannot be wedged by that choice.
 */
export function chose(group: string, value: string): Predicate {
  return (ev) =>
    (ev.type === 'chip:select' && ev.group === group && ev.value === value) ||
    (ev.type === 'field:change' && ev.field === group && ev.value === value)
}

/**
 * The calculator moved to this mode.
 *
 * The top control changes a *segment* and the sub-controls change a *mode*; a lesson cares that
 * the right calculator is on screen, so either announcement counts.
 */
export function switchedTo(mode: string): Predicate {
  return (ev) =>
    (ev.type === 'mode:change' && ev.mode === mode) || (ev.type === 'segment:change' && ev.segment === mode)
}

/** A result card appeared for this mode. */
export function calculated(mode: string): Predicate {
  return (ev) => ev.type === 'result:shown' && ev.mode === mode
}

/** A named action happened: `TOUR_ACTIONS`, or one of the four in `actions.ts`. */
export function tapped(name: string): Predicate {
  return (ev) => ev.type === 'action' && ev.name === name
}

export function opened(sheet: string): Predicate {
  return (ev) => ev.type === 'sheet:open' && ev.sheet === sheet
}

export function closed(sheet: string): Predicate {
  return (ev) => ev.type === 'sheet:close' && ev.sheet === sheet
}
