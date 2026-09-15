import type { FieldRule, Mode } from '../calc'
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

export interface FieldSpec {
  /** Stable id. It appears in share links, so it is never renamed once shipped. */
  key: string
  labelKey: string
  kind: FieldKind
  rule: FieldRule
  /** Optional fields validate as 0 when left blank instead of erroring. */
  optional?: boolean
  /** Fixed choices for 'chips' and 'toggle' fields. */
  options?: readonly string[]
  defaultValue?: string
  /** Hides the field until the rest of the state calls for it (e.g. the lens amount). */
  visibleWhen?: (state: ModeState) => boolean
}

/** Everything a pure `compute` needs beyond the field values themselves. */
export interface CalcContext {
  annualInflationPercent: number
  roundingStep: RoundingStep
  now: number
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
}

/** The numbers persisted to history and the basket, in field order then result order. */
export interface ModeSnapshot {
  inputs: number[]
  results: number[]
}

export interface ModeSpec<R = unknown> {
  id: ModeId
  segment: SegmentId
  fields: FieldSpec[]
  /* Declared with method syntax so the registry can hold `ModeSpec<unknown>` values:
   * `compute` and `present` are always called as a matched pair, so the bivariance
   * that method syntax allows is exactly the behaviour we want here. */
  /** Pure. Never touches the DOM, i18n or storage. */
  compute(values: Record<string, number>, ctx: CalcContext): R
  /** Pure formatting of a computed result. */
  present(result: R, values: Record<string, number>, ctx: PresentContext): ResultDisplay
  snapshot(result: R, values: Record<string, number>): ModeSnapshot
}

/**
 * Read a field value. `noUncheckedIndexedAccess` makes every lookup optional, and a
 * field that failed validation never reaches `compute`, so 0 is a safe floor.
 */
export function valueOf(values: Record<string, number>, key: string): number {
  return values[key] ?? 0
}
