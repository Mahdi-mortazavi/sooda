// The default adapter for both signals: it fetches nothing and offers nothing, so the
// pipeline leaves public/data/rates.json exactly as the last human edit left it.
//
// This is not a placeholder — it is the shipping configuration for CPI, because the
// Statistical Center of Iran and the Central Bank refuse connections from non-Iranian
// addresses (see config.json). Figures are entered with:
//   npm run rates:cpi -- --overall 3.4 --as-of 2026-08
//   npm run rates:set -- --fx 1042000 --date 2026-09-15
// Usage: selected by name from scripts/rates/config.json; never run directly.

/** @returns {Promise<null>} no data on offer, which the pipeline reads as "no change". */
export async function fetchFx() {
  return null
}

/** @returns {Promise<null>} */
export async function fetchCpi() {
  return null
}
