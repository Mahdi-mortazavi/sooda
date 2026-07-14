<div align="center">

[🇬🇧 English version](./README.md)

<img src="public/pwa-192x192.png" width="110" alt="آیکون سودا — قطره‌ای شیشه‌ای با علامت درصد" />

# سودا · Sooda

**سود و قیمت، شفاف مثل شیشه**

ماشین‌حساب سود، قیمت و تخفیف با طراحی «شیشهٔ مایع» — آفلاین، دوزبانه، خصوصی.

[![Deploy](https://github.com/Mahdi-mortazavi/sooda/actions/workflows/deploy.yml/badge.svg)](https://github.com/Mahdi-mortazavi/sooda/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg)](./LICENSE)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8.svg)](https://mahdi-mortazavi.github.io/sooda/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](./tsconfig.json)

### ✨ [**باز کردن اپلیکیشن ←**](https://mahdi-mortazavi.github.io/sooda/) ✨

<img src="docs/screenshots/hero.png" width="720" alt="سودا در حالت روشن و تیره" />

</div>

---

<div dir="rtl">

## ✨ امکانات

- **سه ماشین‌حساب، با یک لمس**
  - **درصد سود** — قیمت خرید + درصد سود دلخواه ← قیمت فروش و مبلغ سود
  - **قیمت فروش** — قیمت خرید + قیمت فروش ← درصد و مبلغ سود (زیان به‌وضوح با رنگ قرمز نمایش داده می‌شود)
  - **تخفیف** — قیمت اصلی + درصد تخفیف ← قیمت نهایی و مبلغ صرفه‌جویی
- **📴 کاملاً آفلاین** — یک PWA واقعی: بعد از اولین بازدید، حتی در حالت هواپیما هم کار می‌کند
- **🔒 حریم خصوصی اول** — بدون سرور، بدون ردیابی، بدون آنالیتیکس؛ داده‌های شما هرگز از دستگاه خارج نمی‌شود
- **🌐 دوزبانه و راست‌چینِ واقعی** — فارسی و انگلیسی با تغییر آنی؛ چیدمان، انیمیشن‌ها و آیکون‌ها به‌درستی آینه می‌شوند
- **۱۲۳ ارقام فارسی** — هرجا خواستید با ارقام فارسی/عربی تایپ کنید؛ نمایش اعداد با قالب‌بندی درست fa-IR و en-US
- **🕘 تاریخچه** — همهٔ محاسبه‌ها به‌صورت محلی (IndexedDB) ذخیره می‌شوند؛ با جست‌وجو و خروجی CSV
- **💎 طراحی شیشهٔ مایع** — بلور و اشباع پس‌زمینه، حاشیه‌های مویی گرادیانی، جلوهٔ شکست نور، حباب‌های رنگی محیطی و فیزیک فنری در همهٔ انیمیشن‌ها
- **🌗 پوستهٔ روشن / تیره / خودکار** با کلید تغییر انیمیشنی
- **♿ دسترس‌پذیر** — امتیاز ۱۰۰ دسترس‌پذیری در Lighthouse، اعلام نتیجه با `aria-live`، پشتیبانی کامل صفحه‌کلید و احترام به `prefers-reduced-motion`

## 📲 نصب به‌عنوان اپلیکیشن

۱. آدرس **[mahdi-mortazavi.github.io/sooda](https://mahdi-mortazavi.github.io/sooda/)** را باز کنید

۲. **آیفون (سافاری):** دکمهٔ Share ← گزینهٔ *Add to Home Screen*

۳. **اندروید (کروم):** منوی ⋮ ← گزینهٔ *Add to Home screen*

۴. **دسکتاپ (کروم/اج):** روی آیکون نصب در نوار آدرس کلیک کنید

## 🛠 تکنولوژی‌ها

| لایه | انتخاب |
| --- | --- |
| ساخت | Vite + TypeScript (strict) |
| رابط کاربری | React 18 و Tailwind CSS v4 و motion |
| PWA | vite-plugin-pwa (Workbox، پیش‌ذخیرهٔ کامل، به‌روزرسانی خودکار) |
| ذخیره‌سازی | Dexie (IndexedDB) |
| چندزبانگی | i18next + react-i18next |
| فونت‌ها | فونت‌های متغیر وزیرمتن و Inter (خود-میزبان، بدون CDN) |
| تست | Vitest (موتور محاسبه و نرمال‌سازی اعداد) |
| CI/CD | GitHub Actions ← GitHub Pages |

## 🧑‍💻 توسعهٔ محلی

</div>

```bash
git clone https://github.com/Mahdi-mortazavi/sooda.git
cd sooda
npm install
npm run dev        # اجرای سرور توسعه
npm test           # اجرای تست‌ها
npm run verify     # بررسی تایپ + تست + بیلد نهایی
```

<div dir="rtl">

## 🗺 نقشهٔ راه

- [x] ماشین‌حساب‌های درصد سود، قیمت فروش و تخفیف
- [x] دوزبانهٔ فارسی/انگلیسی با راست‌چین کامل
- [x] PWA آفلاین با پیش‌ذخیرهٔ کامل
- [x] تاریخچه با جست‌وجو، حذف و خروجی CSV
- [ ] پیش‌تنظیم واحد پول (تومان، ریال، دلار، یورو)
- [ ] حالت تخفیف معکوس (قیمت نهایی ← قیمت اصلی)
- [ ] لینک اشتراک‌گذاری محاسبه

## 🤝 مشارکت

از مشارکت شما استقبال می‌کنیم — [CONTRIBUTING.md](./CONTRIBUTING.md) و [آیین‌نامهٔ رفتار](./CODE_OF_CONDUCT.md) را ببینید.

## 📄 مجوز

[MIT](./LICENSE) © مهدی مرتضوی

</div>
