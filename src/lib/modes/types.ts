import type { FieldRule, Mode, ValidationError } from '../calc'
import type { ProfitStatus } from '../inflation'
import type { AppLanguage } from '../numbers'
import type { RoundingStep } from '../rounding'
import type { Unit } from '../units'

/** Every calculator a segment can show. Same union as `Mode`; named for intent at call sites. */
export type ModeId = Mode

/** The three buttons in the top segmented control. Some segments hold more than one mode. */
export type SegmentId = 'profit' | 'sell' | 'discount'

/** How a field is rendered and edited. */
export type FieldKind = 'money' | 'percent' | 'count' | 'chips' | 'toggle'

/** Raw, per-field input strings for one mode — exactly what the text inputs hold. */
export type ModeState = Record<string, string>

/** Where a field is rendered: inside the input card, or in the lens row below it. */
export type FieldGroup = 'inputs' | 'lens'

export interface FieldSpec {
  /** Stable id. It appears in share links, so it is never renamed once shipped. */
  key: string
  labelKey: string
  kind: FieldKind
  rule: FieldRule
  /** Optional fields validate as 0 when left blank instead of erroring. */
  optional?: boolean
  group?: FieldGroup
  /** Fixed choices for 'chips' and 'toggle' fields. */
  options?: readonly string[]
  /** i18n keys for each option, positionally matched to `options`. */
  optionLabelKeys?: readonly string[]
  /** Chips fields may also accept a typed-in value. */
  allowCustom?: boolean
  defaultValue?: string
  /** Hides the field until the rest of the state calls for it (e.g. the lens amount). */
  visibleWhen?: (state: ModeState) => boolean
}

/** Everything a pure `compute` needs beyond the field values themselves. */
export interface CalcContext {
  annualInflationPercent: number
  roundingStep: RoundingStep
  now: number
  /** Raw field state, so a mode can read its 'toggle' fields — those carry no numeric value. */
  state: ModeState
}

export type Translate = (key: string, vars?: Record<string, unknown>) => string

/** Everything a pure `present` needs to turn numbers into display strings. */
export interface PresentContext {
  t: Translate
  lang: AppLanguage
  unit: Unit
  fmtMoney: (value: number) => string
  fmtNumber: (value: number) => string
  roundingStep: RoundingStep
  /** Identity of this particular calculation, so the card can re-animate. */
  key: string
}

/** The real-profit block the card grows to show when the lens is active. */
export interface LensBlock {
  months: number
  /** Profit the naive price appears to make. */
  nominalPercent: number
  /** Profit it actually makes once restocking is paid for. */
  realPercent: number
  status: ProfitStatus
  /** What buying the same goods again will cost. */
  replacement: number
  explainer: string
  notice?: string
}

/** Enough to render and share an instalment schedule. */
export interface ScheduleInfo {
  installment: number
  count: number
  downPayment: number
  total: number
  /** The first instalment falls one month after this. */
  startAt: number
}

/** What the result card renders. Modes produce this; the card never computes. */
export interface ResultDisplay {
  key: string
  primaryLabel: string
  primaryValue: number
  /** Set for percentage results (the ٪/% sign); money results carry the active unit instead. */
  primaryUnit?: string
  secondaryLabel: string
  secondaryValue: number
  secondaryUnit?: string
  isLoss: boolean
  notice?: string
  copyText: string
  /** Extra rows shown under the separator, e.g. required markup. */
  extras?: { label: string; value: string }[]
  /** Shown when price rounding moved the primary value. */
  exactPrimary?: string
  lens?: LensBlock
  /** Healthy / thin / losing chip shown next to the primary value. */
  status?: ProfitStatus
  statusLabel?: string
  schedule?: ScheduleInfo
  /** Values a 'save to my products' action needs; absent when the mode has no product to save. */
  product?: { cost: number; targetMarginPercent: number; price: number }
}

/** The numbers persisted to history and the basket, in field order then result order. */
export interface ModeSnapshot {
  inputs: number[]
  results: number[]
}

/**
 * The pure behaviour of a mode — everything that needs its maths loaded.
 *
 * Declared with method syntax so the registry can hold `ModeBehaviour<unknown>` values:
 * `compute` and `present` are always called as a matched pair, so the bivariance that
 * method syntax allows is exactly the behaviour we want here.
 */
export interface ModeBehaviour<R = unknown> {
  /** Cross-field rules a single FieldRule cannot express. Keys are field keys. */
  validate?(values: Record<string, number>, state: ModeState): Record<string, ValidationError> | null
  /** Pure. Never touches the DOM, i18n or storage. */
  compute(values: Record<string, number>, ctx: CalcContext): R
  /** Pure formatting of a computed result. */
  present(result: R, values: Record<string, number>, ctx: PresentContext): ResultDisplay
  snapshot(result: R, values: Record<string, number>): ModeSnapshot
}

export interface ModeSpec<R = unknown> extends ModeBehaviour<R> {
  id: ModeId
  segment: SegmentId
  fields: FieldSpec[]
}

/**
 * A mode whose maths is fetched on demand. Its fields stay static so the shell can
 * render, validate and build share links without paying for the calculation code.
 */
export interface DeferredModeSpec {
  id: ModeId
  segment: SegmentId
  fields: FieldSpec[]
  load: () => Promise<ModeBehaviour>
}

export type RegisteredMode = ModeSpec | DeferredModeSpec

export function isDeferred(mode: RegisteredMode): mode is DeferredModeSpec {
  return 'load' in mode
}

/**
 * Read a field value. `noUncheckedIndexedAccess` makes every lookup optional, and a
 * field that failed validation never reaches `compute`, so 0 is a safe floor.
 */
export function valueOf(values: Record<string, number>, key: string): number {
  return values[key] ?? 0
}
