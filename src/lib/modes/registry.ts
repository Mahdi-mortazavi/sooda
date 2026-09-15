import { validateValue, type Mode, type ValidationError } from '../calc'
import { parseAmount } from '../numbers'
import { discountMode } from './discount'
import { profitMode } from './profit'
import { reverseDiscountMode } from './rdiscount'
import { sellMode } from './sell'
import type { CalcContext, ModeId, ModeSnapshot, ModeSpec, ModeState, PresentContext, ResultDisplay, SegmentId } from './types'

/** Every calculator the app can run, keyed by its stable id. */
export const MODE_REGISTRY: Record<ModeId, ModeSpec> = {
  profit: profitMode,
  sell: sellMode,
  discount: discountMode,
  rdiscount: reverseDiscountMode,
}

/** Segment order drives the sliding indicator and the slide direction. */
export const SEGMENTS: readonly SegmentId[] = ['profit', 'sell', 'discount'] as const

export function modeSpec(mode: ModeId): ModeSpec {
  return MODE_REGISTRY[mode]
}

export function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MODE_REGISTRY, value)
}

export function segmentIndexOf(mode: ModeId): number {
  return SEGMENTS.indexOf(MODE_REGISTRY[mode].segment)
}

/** The mode a segment opens on when you tap it. The first one registered for that segment wins. */
export function defaultModeOfSegment(segment: SegmentId): ModeId {
  for (const spec of Object.values(MODE_REGISTRY)) {
    if (spec.segment === segment) return spec.id
  }
  return 'profit'
}

/** Field keys in declaration order — the order share links and history snapshots use. */
export function fieldKeysOf(mode: ModeId): string[] {
  return MODE_REGISTRY[mode].fields.map((f) => f.key)
}

/** Blank input state for one mode, honouring each field's default. */
export function emptyState(mode: ModeId): ModeState {
  const state: ModeState = {}
  for (const field of MODE_REGISTRY[mode].fields) state[field.key] = field.defaultValue ?? ''
  return state
}

export function emptyStates(): Record<ModeId, ModeState> {
  const out = {} as Record<ModeId, ModeState>
  for (const mode of Object.keys(MODE_REGISTRY) as ModeId[]) out[mode] = emptyState(mode)
  return out
}

/** Fields currently on screen — `visibleWhen` hides the rest. */
export function visibleFields(mode: ModeId, state: ModeState) {
  return MODE_REGISTRY[mode].fields.filter((f) => !f.visibleWhen || f.visibleWhen(state))
}

export interface ModeValidation {
  values: Record<string, number>
  errors: Record<string, ValidationError>
  ok: boolean
}

/**
 * Parse and validate every visible field of a mode. Hidden fields are skipped, and a blank
 * optional field resolves to 0 rather than an error.
 */
export function validateMode(mode: ModeId, state: ModeState): ModeValidation {
  const values: Record<string, number> = {}
  const errors: Record<string, ValidationError> = {}
  for (const field of visibleFields(mode, state)) {
    const raw = state[field.key] ?? ''
    const empty = raw.trim() === ''
    if (field.optional && empty) {
      values[field.key] = 0
      continue
    }
    const parsed = parseAmount(raw)
    const error = validateValue(parsed, field.rule, empty)
    if (error) errors[field.key] = error
    else values[field.key] = parsed
  }
  return { values, errors, ok: Object.keys(errors).length === 0 }
}

export interface ModeRun {
  display: ResultDisplay
  snapshot: ModeSnapshot
}

/** Compute and present in one step, so callers never have to hold an untyped result. */
export function runMode(
  mode: ModeId,
  values: Record<string, number>,
  calcCtx: CalcContext,
  presentCtx: PresentContext,
): ModeRun {
  const spec = MODE_REGISTRY[mode]
  const result = spec.compute(values, calcCtx)
  return { display: spec.present(result, values, presentCtx), snapshot: spec.snapshot(result, values) }
}

/** Re-exported so callers can keep importing the mode union from one place. */
export type { Mode }

/** A record with one entry per registered mode — keeps callers from hard-coding the mode list. */
export function perMode<T>(make: (mode: ModeId) => T): Record<ModeId, T> {
  const out = {} as Record<ModeId, T>
  for (const mode of Object.keys(MODE_REGISTRY) as ModeId[]) out[mode] = make(mode)
  return out
}
