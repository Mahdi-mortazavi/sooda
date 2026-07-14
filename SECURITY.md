# Security Policy

## Supported versions

Only the latest deployed version at <https://mahdi-mortazavi.github.io/sooda/> is supported.

## Sooda's security model

Sooda is a fully client-side, offline-first PWA:

- **No server, no accounts, no network calls** after the initial page load — there is no backend to attack.
- All user data (calculation history) lives in the browser's IndexedDB on the user's own device and never leaves it.
- All assets (including fonts) are self-hosted and precached by the service worker; no third-party CDNs.

## Reporting a vulnerability

If you find a security issue (e.g. XSS via user input, supply-chain concern in a dependency, service-worker cache poisoning):

1. Please **do not** open a public issue with exploit details.
2. Use [GitHub private vulnerability reporting](https://github.com/Mahdi-mortazavi/sooda/security/advisories/new) to report it privately.
3. You should receive a response within a week. Once fixed, we'll credit you in the release notes unless you prefer otherwise.
