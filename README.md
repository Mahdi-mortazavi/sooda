<div align="center">

[🇮🇷 **نسخهٔ فارسی**](./README.fa.md)

<br />

<img src="public/pwa-192x192.png" width="120" alt="Sooda app icon — a liquid-glass droplet holding a percent mark" />

# Sooda

### Profit math, crystal clear. 💎

**The liquid-glass calculator for sellers & smart shoppers** — know your profit, price and discount in one tap,
and see whether that profit is *real* once inflation is paid for.
Works 100% offline. Speaks English & فارسی. Tracks nothing.

<br />

<a href="https://mahdi-mortazavi.github.io/sooda/"><img src="https://img.shields.io/badge/▶%20Open%20Sooda-mahdi--mortazavi.github.io%2Fsooda-0f7a5f?style=for-the-badge" alt="Open Sooda" /></a>

[![Deploy](https://github.com/Mahdi-mortazavi/sooda/actions/workflows/deploy.yml/badge.svg)](https://github.com/Mahdi-mortazavi/sooda/actions/workflows/deploy.yml)
[![Lighthouse 100](https://img.shields.io/badge/Lighthouse-100%20·%20100%20·%20100%20·%20100-brightgreen)](https://mahdi-mortazavi.github.io/sooda/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://mahdi-mortazavi.github.io/sooda/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](./tsconfig.json)

<br />

<img src="docs/screenshots/hero.png" width="760" alt="Sooda in light and dark mode" />

</div>

<br />

## 🧮 What can it do?

Ask Sooda any of these — get the answer instantly, beautifully:

| You know… | Sooda tells you… |
| --- | --- |
| 🏷 Purchase price + desired **profit %** | The **selling price** & profit amount |
| ⚖️ Purchase price + **selling price** | Your **profit margin** (losses shown honestly, in red) |
| 🛍 Original price + **discount %** | The **final price** & how much you save |
| 🔄 Final price + **discount %** | The **original price** before the discount |
| 🧺 Several deals at once | **Basket totals** — total cost, revenue, profit & overall margin |
| ⏳ **When the money comes back** | Your **real profit** — what's left after you rebuy the same goods |
| 💳 Cash price + **number of instalments** | The **monthly instalment**, the total, and the markup it really needs |
| 📅 An instalment deal you already offer | Whether it **beats selling for cash**, in percent and in money |
| 📦 The things you sell | **My products** — which ones are quietly losing money as costs rise |

## ✨ Why you'll love it

- **📈 Real profit, not just nominal** — "cost + 20%" can still leave you unable to restock. Tell Sooda when the money comes back and it shows the price that actually covers buying the same goods again.
- **💳 Instalments the way the market talks** — the monthly payment, the total, and the equivalent *flat monthly rate* — plus a plain answer to "is the deal I already offer profitable?" and a customer-facing payment schedule with Jalali dates.
- **📦 My products** — save what you sell; Sooda ages each purchase price against inflation and flags what has quietly turned unprofitable. Reprice in bulk with a preview and a 10-second undo.
- **📴 Truly offline** — after the first visit it works in airplane mode, forever. No loading spinners, no "check your connection".
- **🔒 Radically private** — no server, no account, no tracking, no analytics. Your numbers never leave your device; the only thing Sooda downloads is a public rates file from its own site.
- **⚡ Instant** — first paint in ~0.8 s on throttled 4G; Lighthouse **100 / 100 / 100 / 100**. Three whole features arrived in v1.3 for **+913 bytes** of first-paint payload.
- **🌐 Persian-native** — full RTL, Persian digits everywhere (type ۲۵۰۰۰۰, see ۲۵۰٬۰۰۰), Jalali dates in history, instant EN ⇄ FA switching.
- **💱 Your currency** — Toman, Rial, $ or € on every result, history entry and CSV export.
- **🔢 Live 3-digit grouping** — numbers group as you type: `1250000` becomes `1,250,000`.
- **🔗 Shareable results** — send any calculation as a link; it opens pre-computed, even offline.
- **🧺 Basket mode** — add several calculations and see totals with the overall margin.
- **🔢 Price rounding** — round selling prices up to the nearest 1,000 / 5,000 / 10,000 / 50,000, so you never lose margin to a rounded number.
- **💾 Backup & restore** — one JSON file with your products, history, basket and settings; merge or replace on the way back in.
- **🔄 Always current** — the app re-checks for a new version hourly and when you come back to it, restores what you were typing across the reload, and shows you what changed once.
- **💎 Liquid-glass design** — real backdrop blur, refraction shine, ambient color, spring physics. Feels like a native iOS app, not a website.
- **📲 One-tap install** — native install prompt on Android/desktop, illustrated Add-to-Home-Screen guide on iPhone, home-screen shortcuts to each calculator.
- **♿ Accessible** — screen-reader announcements, full keyboard support, `prefers-reduced-motion` respected.

## 📈 Smart price growth

Sooda never asks you for "the inflation rate" — nobody knows it, and it isn't one number anyway.
Phones track the dollar, clothing tracks domestic costs, food follows its own curve. So Sooda
estimates a **monthly price-growth rate for each product** and shows its working.

Three signals, blended per product:

1. **Your own price history.** Every purchase price you record is a data point. Sooda fits a
   line through them, weighting recent ones more heavily. This signal is the strongest and the
   most private — it never leaves your phone.
2. **Category inflation.** Your product's category is mapped to the matching official CPI
   division, so a clothing shop is not priced off the food index.
3. **Dollar sensitivity.** Mark a product Iranian, part-imported or fully dollar-linked, and
   Sooda weighs a free-market USD rate accordingly.

The more prices you record, the more the estimate leans on *your* shop rather than the national
average — and the card tells you exactly how much of the number came from where. Every figure is
labelled as an estimate, and you can always set a rate by hand.

**Privacy is unchanged.** Sooda downloads one public rates file from its own site. Nothing about
your products, prices or shop is ever uploaded — there is no server to upload it to. Automatic
rate updates can be turned off in Settings, and the app then keeps using the last file it
downloaded — or the copy bundled with it, if it never downloaded one.

## 📱 Screenshots

<div align="center">

| Profit % | Sell price (loss) | Discount |
| :---: | :---: | :---: |
| <img src="docs/screenshots/en/profit-light.png" width="240" alt="Profit calculator, light theme" /> | <img src="docs/screenshots/en/sell-loss-light.png" width="240" alt="Sell price with a loss shown in red" /> | <img src="docs/screenshots/en/discount-dark.png" width="240" alt="Discount calculator, dark theme, USD" /> |

| Reverse discount | Basket totals | History |
| :---: | :---: | :---: |
| <img src="docs/screenshots/en/rdiscount-light.png" width="240" alt="Reverse discount recovering the original price" /> | <img src="docs/screenshots/en/basket-dark.png" width="240" alt="Basket with summed totals and overall margin" /> | <img src="docs/screenshots/en/history-light.png" width="240" alt="Searchable calculation history" /> |

| First launch | iOS install guide | Settings |
| :---: | :---: | :---: |
| <img src="docs/screenshots/welcome.png" width="240" alt="Bilingual language picker on first launch" /> | <img src="docs/screenshots/en/install-ios.png" width="240" alt="Step-by-step Add to Home Screen guide" /> | <img src="docs/screenshots/en/settings-dark.png" width="240" alt="Settings with language, theme and currency" /> |

**New in v1.3**

| Real profit | Instalment pricing | Payment schedule |
| :---: | :---: | :---: |
| <img src="docs/screenshots/en/lens-light.png" width="240" alt="Nominal profit versus real profit after restocking" /> | <img src="docs/screenshots/en/installment-dark.png" width="240" alt="Monthly instalment, total and required markup" /> | <img src="docs/screenshots/en/schedule-light.png" width="240" alt="Instalment schedule with due dates" /> |

| My products | Persian — real profit | Persian — my products |
| :---: | :---: | :---: |
| <img src="docs/screenshots/en/products-light.png" width="240" alt="Saved products with health chips" /> | <img src="docs/screenshots/fa/lens-dark.png" width="240" alt="Real profit in Persian, right to left" /> | <img src="docs/screenshots/fa/products-dark.png" width="240" alt="My products in Persian, right to left" /> |

</div>

## 📲 Install it like an app

1. Open **[mahdi-mortazavi.github.io/sooda](https://mahdi-mortazavi.github.io/sooda/)**
2. **iPhone / iPad (Safari):** Share <kbd>⬆︎</kbd> → *Add to Home Screen* — the app itself shows you an illustrated guide
3. **Android (Chrome):** tap the **Install** banner Sooda shows you, or menu ⋮ → *Add to Home screen*
4. **Desktop (Chrome / Edge):** click the install icon in the address bar

After installing, long-press the icon for **shortcuts** straight into Profit %, Sell price, Discount or My products. ✈️ Then try airplane mode — everything still works.

## 🛠 Under the hood

| Layer | Choice |
| --- | --- |
| Build | [Vite](https://vitejs.dev) + TypeScript (strict) |
| UI | React 18 · [Tailwind CSS v4](https://tailwindcss.com) · [motion](https://motion.dev) spring physics |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) — Workbox full precache, auto-update, shortcuts |
| Storage | [Dexie](https://dexie.org) (IndexedDB) — history, basket & products |
| i18n | i18next + react-i18next, RTL-first |
| Fonts | Self-hosted [Inter](https://rsms.me/inter/) & [Vazirmatn](https://rastikerdar.github.io/vazirmatn/) variable fonts — zero CDN |
| Modes | A mode registry: each calculator is a pure `compute` + `present` pair with its own field specs |
| Speed | Static pre-paint shell, inlined critical CSS, one translation chunk per language, code-split sheets, deferred SW |
| Tests | Vitest — 277 unit tests, plus `npm run smoke` driving the real flows in a browser |
| CI/CD | GitHub Actions → GitHub Pages |

## 🧑‍💻 Local development

```bash
git clone https://github.com/Mahdi-mortazavi/sooda.git
cd sooda
npm install
npm run dev        # start dev server
npm test           # run unit tests
npm run verify     # typecheck + test + production build
```

Extras:

| Command | What it does |
| --- | --- |
| `npm run assets` | Regenerate icons and home-screen shortcut tiles |
| `npm run screenshots` | Playwright gallery into `docs/screenshots/` |
| `npm run smoke` | Drive the built app through the real flows in a browser |
| `npm run budget` | Fail if the first-paint payload grew past its ceiling |
| `npm run i18n:check` | Fail if the English and Persian bundles drift apart |

## 🗺 Roadmap

- [x] Profit %, sell-price, discount & reverse-discount calculators
- [x] Bilingual EN/FA with full RTL · Persian digits · live 3-digit grouping
- [x] Offline-first PWA · install flow · home-screen shortcuts
- [x] History + CSV · currency presets · shareable links · basket totals
- [x] Real-profit lens — nominal vs. real once restocking is paid for
- [x] Instalment pricing, reverse check & customer-facing payment schedule
- [x] My products with health, bulk reprice and undo
- [x] Configurable rounding (round selling price up to 1,000s)
- [x] Backup & restore · periodic update checks · What's New
- [ ] Named basket items & basket export
- [ ] Per-product price history and a margin trend over time
- [ ] Supplier notes and reorder reminders

## 👋 Meet the maker

<div align="center">

<img src="public/avatar-mahdi.png" width="96" style="border-radius: 50%" alt="Mahdi Mortazavi" />

**Mahdi Mortazavi** · مهدی مرتضوی

Creator of Sooda — always happy to hear your ideas, feedback and hellos.

<a href="https://telegram.me/Mahdi_mortazavi1"><img src="https://img.shields.io/badge/Telegram-@Mahdi__mortazavi1-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Chat on Telegram" /></a>

*May your work be blessed and your profit abundant 🌿✨*

</div>

## 🤝 Contributing & license

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md). Licensed under [MIT](./LICENSE).
