# Security Policy

## Supported versions

Only the latest deployed version at <https://mahdi-mortazavi.github.io/sooda/> is supported.

## Sooda's security model

Sooda is a fully client-side, offline-first PWA:

- **No server, no accounts, no telemetry.** The only runtime network requests are same-origin
  GETs to Sooda's own site: the app's own assets, a periodic service-worker update check, and
  one public rates file (`data/rates.json`). No request carries any user data, and the rates
  fetch can be turned off in Settings.
- All user data — calculation history, basket, saved products, per-product price observations
  and the store profile — lives in this device's IndexedDB and `localStorage` and never leaves it.
- All assets (including fonts) are self-hosted and precached by the service worker; no third-party CDNs.

## Reporting a vulnerability

If you find a security issue (e.g. XSS via user input, supply-chain concern in a dependency, service-worker cache poisoning):

1. Please **do not** open a public issue with exploit details.
2. Use [GitHub private vulnerability reporting](https://github.com/Mahdi-mortazavi/sooda/security/advisories/new) to report it privately.
3. You should receive a response within a week. Once fixed, we'll credit you in the release notes unless you prefer otherwise.
