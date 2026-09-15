/**
 * The tour event bus.
 *
 * This is the only file under `src/learn/coach` that a component imports directly, so it
 * rides in the entry chunk and has to stay close to free: with no tour listening, `emitTour`
 * is one comparison and a return. Everything else the coach owns — the overlay, the runner,
 * the geometry — is reachable only through a dynamic import.
 *
 * Components announce what the user did. They never learn that a tour exists.
 */

/** Frozen in `docs/v1.5-plan.md` — do not widen or reorder without amending that file. */
export type TourEvent =
  | { type: 'field:change'; field: string; value: string }
  | { type: 'field:commit'; field: string; value: number }
  | { type: 'chip:select'; group: string; value: string }
  | { type: 'mode:change'; mode: string }
  | { type: 'segment:change'; segment: string }
  | { type: 'sheet:open'; sheet: string }
  | { type: 'sheet:close'; sheet: string }
  | { type: 'result:shown'; mode: string }
  | { type: 'action'; name: string }

export type TourListener = (event: TourEvent) => void

/**
 * Null until a tour subscribes, and null again the moment the last one leaves, so the
 * cost to a user who never opens a lesson is a null check — not a set, not an iterator.
 */
let listeners: TourListener[] | null = null

/** Announce something the user did. A no-op, one branch wide, when nothing is listening. */
export function emitTour(event: TourEvent): void {
  if (listeners === null) return
  for (const listener of listeners) listener(event)
}

/**
 * Listen until the returned function is called. Subscribing and unsubscribing replace the
 * array rather than mutate it, so a listener that unsubscribes mid-emit cannot make the
 * loop above skip the listener that followed it.
 */
export function subscribeTour(listener: TourListener): () => void {
  listeners = listeners === null ? [listener] : [...listeners, listener]
  return () => {
    if (listeners === null) return
    const remaining = listeners.filter((other) => other !== listener)
    listeners = remaining.length === 0 ? null : remaining
  }
}

/** True while a tour is running. Lets a caller skip work that only a tour would read. */
export function isTourListening(): boolean {
  return listeners !== null
}

/*
 * The two canonical name lists. `sheet` and `name` in the events above are typed `string`
 * because the plan freezes them that way; these give every agent one place to look so the
 * same drawer is not called `store-profile` in one lesson and `profile` in the next.
 *
 * They are plain frozen-by-convention literals with no side effects, so a bundler drops
 * them from the entry chunk — only the lazy tour code ever reads them.
 *
 * `ui` owns the `data-tour` attributes and may append here; nobody renames an entry once
 * a lesson has shipped against it.
 */

/** Every sheet or dialog a step can wait for, kebab-case, matching `sheet:open`/`sheet:close`. */
export const TOUR_SHEETS = [
  'history',
  'settings',
  'basket',
  'save-product',
  'product',
  'product-picker',
  'bulk-reprice',
  'store-profile',
  'check-in',
  'schedule',
  'install-guide',
  'whats-new',
  'outlier',
] as const

/** Every discrete thing a user can do that is not a field, chip, mode or sheet. */
export const TOUR_ACTIONS = [
  'calculate',
  'copy-result',
  'share-link',
  'add-to-basket',
  'save-product',
  'record-cost',
  'apply-new-cost',
  'bulk-apply',
  'bulk-undo',
  'export-csv',
  'clear-history',
  'clear-basket',
  'delete-product',
  'open-lens',
  'switch-tab',
  'switch-unit',
  'switch-theme',
  'switch-language',
  'set-rounding',
  'set-inflation',
  'backup',
  'restore',
  'erase-all',
  'install-app',
] as const

/** Helper unions for code that wants the narrow name; the events themselves stay `string`. */
export type TourSheetName = (typeof TOUR_SHEETS)[number]
export type TourActionName = (typeof TOUR_ACTIONS)[number]
