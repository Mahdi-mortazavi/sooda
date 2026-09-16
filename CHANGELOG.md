# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-09-15

<div dir="rtl">

### داستان این نسخه

آقا رضا سودا را نصب می‌کند و هیچ‌کس به او نمی‌گوید این برنامه چه کار می‌کند. پس این‌بار خود سودا نشانش می‌دهد.

شالی را ۱۰۰٬۰۰۰ تومان خریده و ۲۰٪ سود می‌خواهد. چهار لمس بعد، روی همان صفحه‌ای که هر روز با آن کار خواهد کرد، می‌بیند که اگر آن شال سه ماه روی دستش بماند، آن ۲۰٪ در واقع **۹٫۸۲٪** است — چون تا آن موقع، خریدِ دوبارهٔ همان جنس گران‌تر تمام می‌شود. این تمرین ده ثانیه طول می‌کشد، و همان چیزی است که سودا برای آن ساخته شده.

بعد از آن، هشت درس کوتاه در «آموزش سودا» هست: سود، تخفیف، سود واقعی، اقساط، کالاها، نرخ گرانی، کار روزمره، و پشتیبان‌گیری. هیچ‌کدام خواندنی نیست — روی دکمه‌های واقعی کار می‌کنید، توی یک **مغازهٔ تمرینی** با پنج کالای نمونه که وقتی درس تمام شد پاک می‌شود. کالاها، قیمت‌ها و تاریخچهٔ خودتان دست نمی‌خورد. آخر هر درس یک سؤال هست که خود موتور محاسبهٔ سودا جوابش را بررسی می‌کند، و اگر اشتباه بود کسی سرزنش‌تان نمی‌کند: دوباره امتحان می‌کنید، و بار دوم سودا خودش نشان می‌دهد.

</div>

### Added

- **آموزش سودا — an interactive tutorial you do rather than watch.** Eight lessons, each 50–90 seconds, performed on the real screens with real buttons inside a practice shop stocked with five demo products. Nothing you do in a lesson touches your own shop: it runs on a separate store that is deleted when you leave. Every step waits for you to actually do the thing — nothing advances on a timer — and «رد شدن» is on screen at every moment.
- **A sixty-second first run.** The app opens with your language, three cards, one question about what you mostly use Sooda for, and then a single mission: «آقا رضا» buys something for ۱۰۰٬۰۰۰ and wants ۲۰٪. Four taps later the same sale is worth under ۱۰٪, because in three months it costs more to replace than it did to buy. That is the whole app in one screen, and it is the first thing a new user sees.
- **Every lesson ends with a question the app marks itself.** Not trivia — the answers are computed by Sooda's own engine, so a challenge cannot drift away from what the app actually does. A wrong answer is never corrected and never called wrong: you simply try again, and after a second try the lesson offers to show you where the answer was.
- **«کمی گیر کرده‌اید؟ نشانم بده»** — every step can demonstrate itself, with a finger that taps and types for you. Under «کاهش حرکت» it is a still ring and a sentence instead.
- **Help where you are, not only in a menu.** A «؟» beside the parts of the app that have a lesson behind them, a suggestion on an empty screen, and a link that opens one lesson directly.
- **Your progress is yours.** Which lessons you have finished rides in your backup file, and "Erase all data" clears it with everything else.

### Changed

- The bundled price-growth figures moved to a monthly basis and now carry real national numbers (Statistical Center of Iran, Mordad ۱۴۰۵), with their source and date on screen. Lessons deliberately ignore them and pin ۳٪/month, so a lesson's answer cannot change when a figure is updated.
- "Add to home screen" is now a row in Settings as well as a prompt.

### Fixed

- **Undoing a bulk reprice now takes back the price readings it created**, instead of leaving them behind to be learned from.

## [1.4.1] - 2026-09-15

### Fixed

- **A browser that refuses to store data no longer costs you the whole app.** v1.4.0 wrapped everything in a single error boundary, so one database failure inside one feature replaced the entire screen — including the calculator, which needs no storage at all. Storage-backed features (products, history, basket, the product link under a result) now fail on their own, and the calculator keeps working. Covered by a browser test that runs the app with IndexedDB completely disabled.
- **The error message no longer blames your browser for our bugs.** Any render error at all used to produce "turn off private browsing", which does nothing for a fault that has nothing to do with storage. The cause is now detected: a genuine storage problem says so and explains that the calculator still works, and anything else is reported honestly as a fault in Sooda, with a "try again" button.

## [1.4.0] - 2026-09-15

### Added

- **Smart price growth (نرخ گرانی هوشمند):** inflation is not one number, so Sooda no longer treats it as one. It estimates a **monthly price-growth rate for each product** from three signals — the purchase prices you record yourself, the inflation figure for that product's category, and the dollar for imported goods — and shows its working. **"Why this number?"** breaks down how much of the estimate came from where, and every figure is labelled an estimate, never a fact.
- **Store profile (مشخصات مغازه):** two questions — what you sell, and how dollar-linked your goods are — asked once, never at launch, and only the first time the answer would change a number on screen. Skipping is remembered.
- **Price check-in (بررسی قیمت‌ها):** Sooda works out which products have most likely moved and offers to walk you through them one at a time, worst first. Record a new price, mark it unchanged, or leave it for later; a price that looks like a one-off sale is queried before it is learned from. Products that went up hand straight over to bulk reprice.
- **Passive learning:** a purchase price typed into the calculator, or entered through a product's new-cost shortcut, can be recorded against that product in one tap. The estimate gets better the more the app is used, and nothing is written without being asked.
- **Automatic rate updates:** a small public rates file is fetched from Sooda's own site, with an off switch in Settings. It is deliberately kept out of the installed app's cache, so a daily rate change never pushes an app update to your phone.
- A rates pipeline (`.github/workflows/rates.yml`) with manual CLI tools, plus [`docs/rates.md`](./docs/rates.md) explaining exactly what a maintainer must fill in.

### Changed

- **Both READMEs rewritten for sellers rather than developers**, opening with a story and covering every part of the app in the same shape: who it is for, three steps, a worked example, a screenshot, a tip. Every example number is computed from the real engine by `npm run docs:examples`.
- **"Erase all data" now erases all data.** It previously cleared only the calculation history, leaving saved products and their price history behind — which matters more now that Sooda stores a per-product purchase-price history.
- Confidence in an estimate no longer collapses to "low" just because the national figures are old: a stale file costs only as much as the file contributed.
- Project descriptions rewritten in one voice across the manifest, meta tags and package metadata.

### Fixed

- **A missing signal is now an abstention, not a forecast of zero.** The blend substituted 0 in log space for any signal it lacked, which is the claim "prices are flat" — so a fully-imported product with no dollar data forecast 0%/month, and a clean 5%/month personal trend came out as 4.27%. Both were the shipped default, because the rates file starts empty.
- A manual rate override was ignored on the restock path, which could quote a cost built from a rate the card never showed.
- The rate headline said "price rise" even when the number was negative, and the dollar line said "up" when the dollar had fallen.
- A future-dated price reading (a skewed clock, a mistyped year) inflated how much the estimate trusted your own history.
- The store-profile question reappeared on every visit unless dismissed with the one button that happened to be wired up.
- English counted strings said "1 products".

### Security

- The rates fetch no longer sends credentials or a referrer, and has an 8-second deadline. `github.io` is a shared origin, so a default same-origin request could have carried a cookie set by an unrelated page.
- A Content-Security-Policy with `connect-src 'self'` makes "nothing leaves your device" a rule the browser enforces rather than one that survives on code review.
- CSV exports escape leading `=`, `+`, `-` and `@`, so a product name can no longer become a formula in Excel.
- An error boundary replaces the blank page a browser that refuses storage used to produce, and `SECURITY.md` no longer claims the app makes no network calls.

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
