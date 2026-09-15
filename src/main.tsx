import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { StorageBoundary } from './components/StorageBoundary'
import { applyDocumentLanguage, initI18n } from './i18n'
import './index.css'

// Register the service worker after the page is fully loaded so precaching
// never competes with first-paint resources.
const register = (): void => {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      // A long-open installed app never navigates, so nothing would re-check the
      // worker on its own — these periodic checks are what deliver new releases.
      // Imported here so the scheduling code never sits in the first-paint bundle.
      if (registration) void import('./lib/update').then((m) => m.startUpdateChecks(registration))
    },
  })
}

if (document.readyState === 'complete') {
  register()
} else {
  window.addEventListener('load', register, { once: true })
}

// The static boot shell in index.html is already painted, so waiting for the one
// translation chunk costs no visible time and keeps the entry chunk lean.
void initI18n()
  .then((lang) => {
    applyDocumentLanguage(lang)
    createRoot(document.getElementById('root') as HTMLElement).render(
      <StrictMode>
        <StorageBoundary>
          <App />
        </StorageBoundary>
      </StrictMode>,
    )
  })
  .catch(() => {
    /* The translation chunk did not arrive — a flaky first visit, or a cache miss just after a
     * deploy. Without this the static shell stays up forever: a first-time user taps a language,
     * the inline handler writes the key, and then nothing happens, with no spinner and no retry.
     * Dropping the boot overlay at least leaves them the readable shell instead of a dead end. */
    document.documentElement.dataset.boot = 'app'
  })
