# Contributing to Sooda

Thanks for your interest in improving Sooda! 💎

## Getting started

```bash
git clone https://github.com/Mahdi-mortazavi/sooda.git
cd sooda
npm install
npm run dev
```

## Before you open a PR

1. **Discuss first** for larger changes — open an issue so we can align on the approach.
2. **Keep the quality bar:** `npm run verify` must pass (typecheck + tests + build).
3. **Add tests** for any change to the calculation engine (`src/lib/calc.ts`) or number handling (`src/lib/numbers.ts`).
4. **Test both directions:** every UI change must look right in English (LTR) *and* Persian (RTL), in light *and* dark themes. `npm run screenshots` helps.
5. **Respect the design language:** liquid glass, iOS-style spacing/typography, spring animations, `prefers-reduced-motion` support.
6. **No new network calls.** Sooda is offline-first and privacy-first — no CDNs, no fonts from Google, no analytics. Ever.

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.

## Translations

Persian copy lives in `src/i18n/fa.json`, English in `src/i18n/en.json`. Corrections from native speakers are very welcome — please keep the tone friendly and concise.

## Code of Conduct

By participating you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md).
