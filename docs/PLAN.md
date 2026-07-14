# Sooda — Build Plan

> Working plan for building, polishing and shipping Sooda v1.0.0 autonomously.

## Phase 0 — Scaffold
- Vite + React 18 + TypeScript (strict), Tailwind CSS v4 (`@tailwindcss/vite`), vite-plugin-pwa (Workbox, `autoUpdate`), Vitest.
- `base: '/sooda/'` for GitHub Pages project site.
- Self-host fonts: copy **Vazirmatn** (variable) and **Inter** (variable) woff2 from npm packages into `src/assets/fonts` and commit them (both SIL OFL).

## Phase 1 — Core engine (pure, tested)
- `src/lib/calc.ts` — three modes:
  - profit% → selling price + profit amount
  - selling price → profit % + profit amount (negative = loss, styled/labelled distinctly)
  - discount% → final price + amount saved
- `src/lib/numbers.ts` — Persian/Arabic-Indic digit normalization (۰–۹, ٠–٩), `٫`/`,` decimal handling, locale-aware formatting (`fa-IR` / `en-US`).
- Vitest unit tests for both modules (edge cases: zero, loss, 100% discount, huge values, Persian input).

## Phase 2 — App shell & design system
- Liquid-glass tokens as CSS custom properties + Tailwind v4 `@theme`.
- Ambient color blobs behind glass; `backdrop-filter: blur+saturate` surfaces with gradient 1px borders, inner specular highlight; `@supports` fallback.
- Components: glass segmented control (sliding indicator via `motion` layout animation), glass input cards, pill CTA (press scale 0.97), result card with SVG `feDisplacementMap` refraction accent + count-up numbers.
- Theme: light/dark/system with animated toggle, meta theme-color sync. `prefers-reduced-motion` respected globally.
- i18n: i18next, `en`/`fa`, auto-detect, instant switch, `dir`/`lang` on `<html>`; RTL-mirrored layout & animations.

## Phase 3 — History & settings
- Dexie (IndexedDB) history: save on calculate, live list (dexie-react-hooks), search, per-item delete, clear-all with confirm, CSV export, empty state.
- Bottom sheet (drag handle, drag-to-dismiss, backdrop blur) for History; settings sheet (language, theme, clear data).

## Phase 4 — PWA, SEO, a11y
- Manifest (maskable 192/512 icons, apple-touch-icon 180) — icon designed as SVG (glass gem + %), rendered to PNG with sharp (`scripts/generate-assets.mjs`), plus 1200×630 OG image.
- Meta: bilingual title/description, canonical, OG/Twitter, hreflang, JSON-LD `SoftwareApplication`.
- Precache everything; verify offline with a headless service-worker check.
- Labels, `aria-live="polite"` results, ≥4.5:1 contrast, `inputmode="decimal"`, visible focus rings, `navigator.vibrate(10)`.

## Phase 5 — CI/CD & repo polish
- `.github/workflows/deploy.yml`: push→typecheck→test→build→`actions/deploy-pages` (Pages enabled programmatically via `configure-pages` `enablement: true`).
- `.github/workflows/release.yml`: on tag `v*` → GitHub Release with notes from CHANGELOG.
- README (EN) + README.fa (RTL), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, issue/PR templates.

## Phase 6 — Verify & ship
- Playwright screenshots at 390×844 (both languages/themes, all modes, history sheet) → review, iterate, save to `docs/screenshots/`.
- Lighthouse (mobile) against production build: Perf ≥95, A11y 100, BP 100, SEO 100; iterate until met.
- Deploy, `curl` live URL + manifest + sw, headless offline verification, tag `v1.0.0`, release.
