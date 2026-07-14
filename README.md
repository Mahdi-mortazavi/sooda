<div align="center">

[🇮🇷 **نسخهٔ فارسی**](./README.fa.md)

<br />

<img src="public/pwa-192x192.png" width="120" alt="Sooda app icon — a liquid-glass droplet holding a percent mark" />

# Sooda

### Profit math, crystal clear. 💎

**The liquid-glass calculator for sellers & smart shoppers** — know your profit, price and discount in one tap.
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

## ✨ Why you'll love it

- **📴 Truly offline** — after the first visit it works in airplane mode, forever. No loading spinners, no "check your connection".
- **🔒 Radically private** — no server, no account, no tracking, no analytics. Your numbers never leave your device.
- **⚡ Instant** — first paint in ~0.8 s on throttled 4G; Lighthouse **100 / 100 / 100 / 100**.
- **🌐 Persian-native** — full RTL, Persian digits everywhere (type ۲۵۰۰۰۰, see ۲۵۰٬۰۰۰), Jalali dates in history, instant EN ⇄ FA switching.
- **💱 Your currency** — Toman, Rial, $ or € on every result, history entry and CSV export.
- **🔢 Live 3-digit grouping** — numbers group as you type: `1250000` becomes `1,250,000`.
- **🔗 Shareable results** — send any calculation as a link; it opens pre-computed, even offline.
- **🧺 Basket mode** — add several calculations and see totals with the overall margin.
- **💎 Liquid-glass design** — real backdrop blur, refraction shine, ambient color, spring physics. Feels like a native iOS app, not a website.
- **📲 One-tap install** — native install prompt on Android/desktop, illustrated Add-to-Home-Screen guide on iPhone, home-screen shortcuts to each calculator.
- **♿ Accessible** — screen-reader announcements, full keyboard support, `prefers-reduced-motion` respected.

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

</div>

## 📲 Install it like an app

1. Open **[mahdi-mortazavi.github.io/sooda](https://mahdi-mortazavi.github.io/sooda/)**
2. **iPhone / iPad (Safari):** Share <kbd>⬆︎</kbd> → *Add to Home Screen* — the app itself shows you an illustrated guide
3. **Android (Chrome):** tap the **Install** banner Sooda shows you, or menu ⋮ → *Add to Home screen*
4. **Desktop (Chrome / Edge):** click the install icon in the address bar

After installing, long-press the icon for **shortcuts** straight into Profit %, Sell price or Discount. ✈️ Then try airplane mode — everything still works.

## 🛠 Under the hood

| Layer | Choice |
| --- | --- |
| Build | [Vite](https://vitejs.dev) + TypeScript (strict) |
| UI | React 18 · [Tailwind CSS v4](https://tailwindcss.com) · [motion](https://motion.dev) spring physics |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) — Workbox full precache, auto-update, shortcuts |
| Storage | [Dexie](https://dexie.org) (IndexedDB) — history & basket |
| i18n | i18next + react-i18next, RTL-first |
| Fonts | Self-hosted [Inter](https://rsms.me/inter/) & [Vazirmatn](https://rastikerdar.github.io/vazirmatn/) variable fonts — zero CDN |
| Speed | Static pre-paint shell, inlined critical CSS, code-split sheets, deferred SW |
| Tests | Vitest — 71 unit tests over the calculation engine, digits, units, share links & basket totals |
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

Extras: `npm run assets` (regenerate icons), `npm run screenshots` (Playwright gallery into `docs/screenshots/`).

## 🗺 Roadmap

- [x] Profit %, sell-price, discount & reverse-discount calculators
- [x] Bilingual EN/FA with full RTL · Persian digits · live 3-digit grouping
- [x] Offline-first PWA · install flow · home-screen shortcuts
- [x] History + CSV · currency presets · shareable links · basket totals
- [ ] Named basket items & basket export
- [ ] Configurable rounding (e.g. round selling price to 1,000s)

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
