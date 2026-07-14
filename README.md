<div align="center">

[🇮🇷 نسخهٔ فارسی](./README.fa.md)

<img src="public/pwa-192x192.png" width="110" alt="Sooda app icon — a glass droplet with a percent mark" />

# Sooda · سودا

**Profit math, crystal clear.**

A liquid-glass profit, price & discount calculator — offline-first, bilingual, private.

[![Deploy](https://github.com/Mahdi-mortazavi/sooda/actions/workflows/deploy.yml/badge.svg)](https://github.com/Mahdi-mortazavi/sooda/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg)](./LICENSE)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8.svg)](https://mahdi-mortazavi.github.io/sooda/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](./tsconfig.json)

### ✨ [**Open the app →**](https://mahdi-mortazavi.github.io/sooda/) ✨

<img src="docs/screenshots/hero.png" width="720" alt="Sooda in light and dark mode" />

</div>

---

## ✨ Features

- **Three calculators, one tap apart**
  - **Profit %** — purchase price + desired profit % → selling price & profit amount
  - **Sell price** — purchase price + selling price → profit % & amount (losses shown clearly in red)
  - **Discount** — original price + discount % → final price & amount saved
- **📴 100% offline** — a full PWA: after the first visit everything works in airplane mode
- **🔒 Privacy-first** — no server, no tracking, no analytics; your data never leaves the device
- **🌐 Bilingual & RTL-native** — English and Persian (فارسی) with instant switching; layout, animations and icons mirror correctly
- **۱۲۳ Persian digits** — type Persian/Arabic digits anywhere; numbers display with proper fa-IR / en-US formatting
- **🕘 History** — every calculation saved locally (IndexedDB), searchable, exportable to CSV
- **💎 Liquid-glass design** — backdrop blur & saturation, gradient hairline borders, refraction shine, ambient color blobs, spring physics everywhere
- **🌗 Light / Dark / Auto** themes with animated toggle
- **♿ Accessible** — Lighthouse 100 accessibility, `aria-live` results, full keyboard support, `prefers-reduced-motion` respected

## 📲 Install as an app

1. Open **[mahdi-mortazavi.github.io/sooda](https://mahdi-mortazavi.github.io/sooda/)**
2. **iOS (Safari):** Share → *Add to Home Screen*
3. **Android (Chrome):** menu ⋮ → *Add to Home screen* (or tap the install banner)
4. **Desktop (Chrome/Edge):** click the install icon in the address bar

## 🛠 Tech stack

| Layer | Choice |
| --- | --- |
| Build | [Vite](https://vitejs.dev) + TypeScript (strict) |
| UI | React 18, [Tailwind CSS v4](https://tailwindcss.com), [motion](https://motion.dev) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Workbox, full precache, auto-update) |
| Storage | [Dexie](https://dexie.org) (IndexedDB) |
| i18n | i18next + react-i18next |
| Fonts | Self-hosted [Inter](https://rsms.me/inter/) & [Vazirmatn](https://rastikerdar.github.io/vazirmatn/) variable fonts |
| Tests | Vitest (calculation engine & number normalization) |
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

Other scripts: `npm run assets` (regenerate icons), `npm run screenshots` (Playwright shots into `docs/screenshots/`).

## 🗺 Roadmap

- [x] Profit %, sell-price and discount calculators
- [x] Bilingual EN/FA with RTL
- [x] Offline-first PWA with full precache
- [x] History with search, delete & CSV export
- [ ] Currency/unit presets (تومان, ریال, $, €)
- [ ] Reverse-discount mode (final price → original price)
- [ ] Shareable calculation links

## 🤝 Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md).

## 📄 License

[MIT](./LICENSE) © Mahdi Mortazavi
