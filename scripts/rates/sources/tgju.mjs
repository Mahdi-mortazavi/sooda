// Free-market USD close from tgju.org's price table, converted rial → toman.
//
// VERIFIED on 2026-09-15 from a US cloud IP (Cloudflare edge IAD): the endpoint below
// answers HTTP 200 with JSON, needs no key, no cookie and no browser user-agent, and
// sets access-control-allow-origin:*. It carries ~3,950 daily rows.
//
// CAVEAT, read before enabling: this is an undocumented internal DataTables endpoint,
// not a published API, and tgju.org has no stated usage policy. Committing its numbers
// into a public MIT repo every day is a licensing decision for the maintainer, which is
// why config.json ships with "adapter": "manual" and this file is opt-in.
//
// Row shape, confirmed arithmetically against the site's own change column:
//   [open, low, high, close, changeHtml, changePctHtml, 'YYYY/MM/DD', 'jalaali']
// Usage: set config.json fx.adapter to "tgju", then `node scripts/rates/update.mjs --fx-only`.
const ENDPOINT = 'https://api.tgju.org/v1/market/indicator/summary-table-data'

/** '2,313,000' → 2313000. Returns NaN for anything that is not a plain number. */
function toNumber(cell) {
  const cleaned = String(cell).replace(/<[^>]*>/g, '').replace(/,/g, '').trim()
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN
}

/** '2026/09/14' → '2026-09-14'. Returns null for anything else, including Jalaali dates. */
function toIsoDate(cell) {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(cell).trim())
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

/**
 * @returns {Promise<{ points: [string, number][], source: { name: string, url: string } } | null>}
 */
export async function fetchFx(config = {}) {
  const indicator = config.indicator ?? 'price_dollar_rl'
  const days = config.days ?? 30
  const url = `${ENDPOINT}/${encodeURIComponent(indicator)}`

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(config.timeoutMs ?? 15000),
  })
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`)

  const body = await response.json()
  if (!Array.isArray(body?.data)) throw new Error(`${url} returned no data array — the endpoint shape changed`)

  const points = []
  for (const row of body.data.slice(0, days)) {
    if (!Array.isArray(row) || row.length < 7) continue
    const date = toIsoDate(row[6])
    const rial = toNumber(row[3])
    if (date === null || !Number.isFinite(rial) || rial <= 0) continue
    // The app's pair is USD/IRT and this indicator quotes rials, so 10 rial = 1 toman.
    // Fractional tomans would be noise at these magnitudes, so the close is rounded.
    points.push([date, Math.round(rial / 10)])
  }
  if (points.length === 0) throw new Error(`${url} parsed to zero usable rows — the endpoint shape changed`)

  points.sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return { points, source: { name: 'TGJU', url: 'https://www.tgju.org/profile/price_dollar_rl' } }
}
