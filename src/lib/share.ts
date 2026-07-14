import { MODES, type Mode } from './calc'
import { isUnit, type Unit } from './units'

/** Parameters encoded in a shareable calculation link. */
export interface ShareParams {
  mode: Mode
  a: number
  b: number
  unit: Unit
}

/** Build the query string for a shareable link, e.g. `?m=profit&a=1250&b=24&u=toman`. */
export function buildShareQuery(params: ShareParams): string {
  const q = new URLSearchParams()
  q.set('m', params.mode)
  q.set('a', String(params.a))
  q.set('b', String(params.b))
  if (params.unit !== 'none') q.set('u', params.unit)
  return `?${q.toString()}`
}

/** Parse a shared-link query string. Returns null unless every part is valid. */
export function parseShareQuery(search: string): ShareParams | null {
  if (!search || search === '?') return null
  const q = new URLSearchParams(search)
  const mode = q.get('m')
  if (!mode || !(MODES as readonly string[]).includes(mode)) return null
  const rawA = q.get('a')
  const rawB = q.get('b')
  if (!rawA || !rawB) return null
  const a = Number(rawA)
  const b = Number(rawB)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const rawUnit = q.get('u') ?? 'none'
  const unit: Unit = isUnit(rawUnit) ? rawUnit : 'none'
  return { mode: mode as Mode, a, b, unit }
}
