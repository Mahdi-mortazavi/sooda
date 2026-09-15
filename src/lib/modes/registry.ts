import { validateValue, type Mode, type ValidationError } from '../calc'
import { parseAmount } from '../numbers'
import { discountMode } from './discount'
import { INSTALLMENT_BASE_FIELDS, INSTALLMENT_REVERSE_FIELDS } from './installmentFields'
import { profitMode } from './profit'
import { reverseDiscountMode } from './rdiscount'
import { sellMode } from './sell'
import {
  isDeferred,
  type CalcContext,
  type ModeBehaviour,
  type ModeId,
  type ModeSnapshot,
  type ModeState,
  type PresentContext,
  type RegisteredMode,
  type ResultDisplay,
  type SegmentId,
} from './types'

/** Every calculator the app can run, keyed by its stable id. */
export const MODE_REGISTRY: Record<ModeId, RegisteredMode> = {
  /* Declaration order matters: the first mode of a segment is the one it opens on.
   * Instalment pricing lives behind a sub-control and carries its own annuity maths,
   * so only its field specs are eager — the calculation itself is fetched on first use. */
  profit: profitMode,
  installment: {
    id: 'installment',
    segment: 'profit',
    fields: INSTALLMENT_BASE_FIELDS,
    load: () => import('./installment').then((m) => m.installmentBehaviour),
  },
  rinstallment: {
    id: 'rinstallment',
    segment: 'profit',
    fields: INSTALLMENT_REVERSE_FIELDS,
    load: () => import('./rinstallment').then((m) => m.reverseInstallmentBehaviour),
  },
  sell: sellMode,
  discount: discountMode,
  rdiscount: reverseDiscountMode,
}

/** Behaviours resolved so far: the eager modes are their own behaviour. */
const behaviours = new Map<ModeId, ModeBehaviour>()

/** Loads a mode's maths if it is not in memory yet. Chunks are precached, so this works offline. */
export async function ensureBehaviour(mode: ModeId): Promise<ModeBehaviour> {
  const cached = behaviours.get(mode)
  if (cached) return cached
  const spec = MODE_REGISTRY[mode]
  const behaviour = isDeferred(spec) ? await spec.load() : spec
  behaviours.set(mode, behaviour)
  return behaviour
}

/** The behaviour if it is already in memory, otherwise undefined — never triggers a load. */
export function loadedBehaviour(mode: ModeId): ModeBehaviour | undefined {
  const spec = MODE_REGISTRY[mode]
  return isDeferred(spec) ? behaviours.get(mode) : spec
}

/** Sibling modes a segment can switch between, in the order its sub-control shows them. */
export function modesOfSegment(segment: SegmentId): ModeId[] {
  return Object.values(MODE_REGISTRY)
    .filter((spec) => spec.segment === segment)
    .map((spec) => spec.id)
}

/** Segment order drives the sliding indicator and the slide direction. */
export const SEGMENTS: readonly SegmentId[] = ['profit', 'sell', 'discount'] as const

export function modeSpec(mode: ModeId): RegisteredMode {
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
    // Toggles pick a variant rather than a quantity, so they never become a value.
    if (field.kind === 'toggle') continue
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
  // Cross-field rules only make sense once every field parsed — and only once the
  // mode's maths is in memory. Callers that need them await ensureBehaviour() first.
  const behaviour = loadedBehaviour(mode)
  if (Object.keys(errors).length === 0 && behaviour?.validate) {
    Object.assign(errors, behaviour.validate(values, state) ?? {})
  }
  return { values, errors, ok: Object.keys(errors).length === 0 }
}

export interface ModeRun {
  display: ResultDisplay
  snapshot: ModeSnapshot
}

/** Compute and present in one step, so callers never have to hold an untyped result. */
export function runMode(
  behaviour: ModeBehaviour,
  values: Record<string, number>,
  calcCtx: CalcContext,
  presentCtx: PresentContext,
): ModeRun {
  const result = behaviour.compute(values, calcCtx)
  return {
    display: behaviour.present(result, values, presentCtx),
    snapshot: behaviour.snapshot(result, values),
  }
}

/** Re-exported so callers can keep importing the mode union from one place. */
export type { Mode }

/** A record with one entry per registered mode — keeps callers from hard-coding the mode list. */
export function perMode<T>(make: (mode: ModeId) => T): Record<ModeId, T> {
  const out = {} as Record<ModeId, T>
  for (const mode of Object.keys(MODE_REGISTRY) as ModeId[]) out[mode] = make(mode)
  return out
}
