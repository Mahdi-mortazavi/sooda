# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-14

### Added

- **Three calculators:** profit % (purchase + profit % → selling price), sell price (purchase + selling → profit %/amount, with clear loss display), and discount (original + % → final price & savings) — all backed by a unit-tested pure calculation engine.
- **Bilingual UI (English/Persian)** with instant in-app switching, full RTL mirroring, and automatic browser-language detection.
- **Persian & Arabic-Indic digit input** with normalization, plus locale-aware number formatting (fa-IR / en-US) throughout.
- **Offline-first PWA:** Workbox precaching of all assets, auto-updating service worker, installable with maskable icons — works fully in airplane mode after first load.
- **History** stored in IndexedDB (Dexie): live list, search (any digit system), per-item delete, clear-all with confirmation, CSV export with UTF-8 BOM, and a friendly empty state.
- **Liquid-glass design system:** backdrop blur + saturation surfaces with gradient hairline borders and specular highlights, ambient drifting color blobs, SVG-refraction shine on the result card, iOS-style typography and spacing.
- **Motion:** spring-physics mode transitions, sliding segmented control, count-up result numbers, staggered history entrance, drag-to-dismiss bottom sheets — all disabled under `prefers-reduced-motion`.
- **Themes:** light / dark / system with animated toggle and theme-color meta sync.
- **Accessibility:** labeled inputs with `inputmode="decimal"`, `aria-live` result announcements, visible focus rings, ≥4.5:1 contrast; Lighthouse 100 accessibility score.
- **Micro-interactions:** haptic feedback (`navigator.vibrate`) on primary actions, copy-result button.
- Self-hosted Inter & Vazirmatn variable fonts (no external requests).
- GitHub Actions CI/CD: typecheck → test → build → deploy to GitHub Pages.

[1.0.0]: https://github.com/Mahdi-mortazavi/sooda/releases/tag/v1.0.0
