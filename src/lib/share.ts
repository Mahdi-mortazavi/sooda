import { MODES, type Mode } from './calc'
import { isUnit, type Unit } from './units'

/** Parameters encoded in a shareable calculation link. `a`/`b` are null for
 *  mode-only deep links (used by PWA home-screen shortcuts). */
export interface ShareParams {
  mode: Mode
  a: number | null
  b: number | null
  unit: Unit
}

/** Build the query string for a shareable link, e.g. `?m=profit&a=1250&b=24&u=toman`. */
export function buildShareQuery(params: ShareParams): string {
  const q = new URLSearchParams()
  q.set('m', params.mode)
  if (params.a !== null) q.set('a', String(params.a))
  if (params.b !== null) q.set('b', String(params.b))
  if (params.unit !== 'none') q.set('u', params.unit)
  return `?${q.toString()}`
}

/** Parse a shared-link query string. Mode is required; numbers are optional
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
