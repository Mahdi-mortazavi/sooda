import { MODES, type Mode } from './calc'
import { fieldKeysOf, isModeId } from './modes/registry'
import type { ModeId } from './modes/types'
import { isUnit, type Unit } from './units'

/** Parameters encoded in a v1-format shareable link. `a`/`b` are null for
 *  mode-only deep links (used by PWA home-screen shortcuts). */
export interface ShareParams {
  mode: Mode
  a: number | null
  b: number | null
  unit: Unit
}

/** Build a v1 query string, e.g. `?m=profit&a=1250&b=24&u=toman`. Still emitted for two-field modes. */
export function buildShareQuery(params: ShareParams): string {
  const q = new URLSearchParams()
  q.set('m', params.mode)
  if (params.a !== null) q.set('a', String(params.a))
  if (params.b !== null) q.set('b', String(params.b))
  if (params.unit !== 'none') q.set('u', params.unit)
  return `?${q.toString()}`
}

/** Parse a v1 shared-link query string. Mode is required; numbers are optional
 *  but must both be present and valid to be kept. */
export function parseShareQuery(search: string): ShareParams | null {
  if (!search || search === '?') return null
  const q = new URLSearchParams(search)
  const mode = q.get('m')
  if (!mode || !(MODES as readonly string[]).includes(mode)) return null
  const rawUnit = q.get('u') ?? 'none'
  const unit: Unit = isUnit(rawUnit) ? rawUnit : 'none'
  const rawA = q.get('a')
  const rawB = q.get('b')
  if (rawA && rawB) {
    const a = Number(rawA)
    const b = Number(rawB)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { mode: mode as Mode, a, b, unit }
    }
  }
  return { mode: mode as Mode, a: null, b: null, unit }
}

/** Parameters of a v2 link: any number of named fields instead of a fixed `a`/`b` pair. */
export interface ModeShareParams {
  mode: ModeId
  values: Record<string, number>
  unit: Unit
}

/**
 * Build a v2 query string, e.g. `?m=profit&v=cost:100000,margin:20&u=toman`.
 * Keys and numbers are URL-safe as they stand, so the `v` list is assembled by hand
 * rather than through URLSearchParams, which would percent-escape `:` and `,`.
 */
export function buildModeShareQuery(params: ModeShareParams): string {
  const pairs: string[] = []
  for (const key of fieldKeysOf(params.mode)) {
    const value = params.values[key]
    if (value === undefined || !Number.isFinite(value)) continue
    pairs.push(`${key}:${value}`)
  }
  let query = `?m=${params.mode}`
  if (pairs.length > 0) query += `&v=${pairs.join(',')}`
  if (params.unit !== 'none') query += `&u=${params.unit}`
  return query
}

/**
 * Parse a shared link in either format. v2 (`v=key:value,…`) wins when present; otherwise the
 * legacy `a`/`b` pair is mapped onto the mode's first two fields. Mode-only shortcut links
 * (`?m=sell`) yield an empty value map.
 */
export function parseModeShareQuery(search: string): ModeShareParams | null {
  if (!search || search === '?') return null
  const q = new URLSearchParams(search)
  const mode = q.get('m')
  if (!isModeId(mode)) return null
  const rawUnit = q.get('u') ?? 'none'
  const unit: Unit = isUnit(rawUnit) ? rawUnit : 'none'
  const keys = fieldKeysOf(mode)
  const values: Record<string, number> = {}

  const rawValues = q.get('v')
  if (rawValues) {
    for (const pair of rawValues.split(',')) {
      const separator = pair.indexOf(':')
      if (separator < 1) continue
      const key = pair.slice(0, separator)
      const value = Number(pair.slice(separator + 1))
      if (keys.includes(key) && Number.isFinite(value)) values[key] = value
    }
    return { mode, values, unit }
  }

  const rawA = q.get('a')
  const rawB = q.get('b')
  const [keyA, keyB] = keys
  if (rawA && rawB && keyA && keyB) {
    const a = Number(rawA)
    const b = Number(rawB)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      values[keyA] = a
      values[keyB] = b
    }
  }
  return { mode, values, unit }
}

export type AppTab = 'calculator' | 'products'

/** PWA shortcuts can deep-link straight to a tab via `?tab=products`. */
export function parseTabQuery(search: string): AppTab | null {
  if (!search) return null
  const tab = new URLSearchParams(search).get('tab')
  return tab === 'products' || tab === 'calculator' ? tab : null
}
