# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-15

### Added

- **Real-profit lens (سود واقعی):** a "when does the money come back?" row on the profit and sell calculators. Pick a delay and Sooda shows nominal profit beside **real** profit — what is left once you have bought the same goods again — with a healthy/thin/losing chip, one plain sentence naming the restock cost, and, in profit mode, the price that actually covers it. **"Now" is the default, so nothing changes until you ask for it.** The restock cost comes from the annual inflation rate in Settings, or from your own figure when you already know today's purchase price.
- **Instalment pricing (فروش اقساطی):** a Cash | Instalments sub-control inside the profit segment. Forward — «چقدر اضافه بگیرم؟» — gives the monthly instalment, the total, the required markup and the equivalent **flat monthly rate** the market actually quotes. Reverse — «شرایط فعلی‌ام سودده است؟» — takes the flat rate you already charge and says whether the deal beats a cash sale, in percent and in money. Both produce a **payment schedule** with Jalali due dates that copies and shares as customer-facing text carrying no margin or profit.
- **My products (کالاهای من):** a second tab, on a floating glass tab bar. Save any result as a product; Sooda ages its purchase price against inflation and flags what has quietly turned unprofitable. Search, sort by risk, edit in a detail sheet, take a new purchase price and get a price that preserves your target margin, or **reprice in bulk** with a preview and a 10-second undo. CSV export included.
- **Price rounding:** round selling prices **up** to the nearest 1,000 / 5,000 / 10,000 / 50,000 so margin is never lost to a rounded number; the exact figure stays visible underneath.
- **Backup & restore:** export products, history, basket and settings as one versioned JSON file, and bring it back with a merge-or-replace choice and schema validation.
- **Periodic update checks:** the app now re-checks for a new version hourly and when you return to it (throttled, skipped while offline), so a long-open installed app can no longer sit on a stale build. What you were typing is saved and restored across the reload.
- **What's New:** a one-time sheet after an upgrade, in your language. It does not appear on a first install.
- A fourth home-screen shortcut straight into My products.

### Changed

- **Modes are now a registry.** Each calculator is a pure `compute` + `present` pair with its own field specs, replacing the hard-wired "two inputs → two results" chain. Calculators can have any number of fields, and the instalment maths loads only when it is first used.
- **Share links v2** — `?m=<mode>&v=<key:value,…>&u=<unit>` — carry the lens and instalment parameters. Links in the old `?m=&a=&b=` format still open and compute exactly as before.
- **Translations are split** into a core bundle loaded on first paint and a bundle that rides along with the first sheet you open, and only the language you actually use is downloaded.
- The theme toggle moved into Settings, so the header keeps three buttons alongside the new tab bar.
- Storage: Dexie `version(3)` adds a `products` table; existing history and basket rows are untouched and keep working.
- **First-paint payload: 123,974 B gzip against v1.2.0's 123,061 B** — three features for +913 bytes, achieved by deferring the result card, the products tab, every sheet, onboarding, the install banner and the instalment maths into chunks the service worker precaches anyway.
- Lighthouse mobile, measured against a v1.2.0 build on the same machine so the comparison is like-for-like: **performance 94 vs 95, accessibility 100, best practices 100, SEO 100** (this build machine is slower than the one v1.2.0's 0.9 s figures were taken on — on it, v1.2.0 measures FCP 2.3 s and v1.3.0 FCP 2.4 s). Three features for one point.
- Accessibility fix along the way: the 12 px footer lines composited to 3.29:1 on the light background. The tertiary text token now reads 4.82:1.
- Tests: **277** unit tests (up from 71), plus `npm run smoke` driving the real flows in a browser, `npm run budget` guarding the first-paint payload and `npm run i18n:check` guarding English/Persian parity. The budget and parity checks now run on every pull request.

[1.3.0]: https://github.com/Mahdi-mortazavi/sooda/releases/tag/v1.3.0

## [1.2.0] - 2026-07-14

### Added

- **Basket mode (سبد محاسبه):** add any result to a basket and see live totals — total cost, revenue, profit and overall margin for sales; total original/pay/saved for purchases — grouped per currency unit, with a header badge counter.
- **PWA home-screen shortcuts:** long-press the installed icon to jump straight into Profit %, Sell price or Discount (bilingual labels, branded icons).
- **Live 3-digit grouping:** numbers group as you type (۱۲۵۰۰۰۰ → ۱٬۲۵۰٬۰۰۰ / 1250000 → 1,250,000) with correct caret handling and localized digits.
- **Developer branding:** footer and Settings now feature Mahdi Mortazavi (مهدی مرتضوی) with photo, a Telegram contact button (@Mahdi_mortazavi1) and a blessing line — in both languages.

### Fixed

- **Mobile tab-switch shake:** mode-slide transitions are now clipped inside their container and `overflow-x: clip` is applied to the page, so switching calculators can no longer widen or shake the viewport; switching also gently re-anchors scroll.

### Changed

- Native-app PWA polish: manifest app name is now simply **"Sooda"**, `launch_handler: navigate-existing`, and rubber-band overscroll is contained in installed (standalone) mode.
- Lighthouse mobile (real devtools throttling): **100 · 100 · 100 · 100** — FCP 0.9 s, LCP 0.9 s, TBT 70 ms.
- READMEs redesigned in both languages: promotional layout, full bilingual screenshot galleries (English shots in the English README, Persian shots in the Persian one), quick-answer table, and a "meet the maker" section.

[1.2.0]: https://github.com/Mahdi-mortazavi/sooda/releases/tag/v1.2.0

## [1.1.0] - 2026-07-14

### Added

- **Currency/unit presets:** Toman (تومان), Rial (ریال), $ and € — selectable in Settings, applied across results, history and CSV export, with locale-aware placement ($19.99 vs ۲۰ دلار).
- **Reverse discount mode:** enter the final (discounted) price + discount % to recover the original price — a fourth calculator living inside the Discount segment as an animated direction toggle.
- **Shareable calculation links:** a share button on every result builds a `?m=&a=&b=&u=` deep link (native share sheet where available, clipboard elsewhere); opening a link pre-fills and auto-computes, fully offline.
- **First-run language onboarding:** an elegant glass overlay lets the user pick فارسی/English on first launch, painted instantly from the static boot shell.
- **PWA install experience:** a polished glass install banner (native `beforeinstallprompt` on Android/desktop) and a step-by-step illustrated Add-to-Home-Screen guide for iOS Safari, with a 14-day dismissal snooze.

### Changed

- **Big performance upgrade:** static pre-paint boot shell (header + footer + welcome painted from HTML alone), inlined critical CSS (zero render-blocking requests), entry script moved to end of body, service-worker registration deferred to `load`, inline-SVG app icon. Lighthouse mobile (real devtools throttling): **Performance 99, FCP 0.8 s, LCP 0.8 s, CLS 0.001**.
- Dark theme and RTL direction now apply before first paint — no theme/direction flash.
- iOS-grade touch feel: no tap highlight, `touch-action: manipulation`, no accidental text selection on controls.

[1.1.0]: https://github.com/Mahdi-mortazavi/sooda/releases/tag/v1.1.0

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
