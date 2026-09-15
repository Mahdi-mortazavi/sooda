import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { applyDocumentLanguage, initI18n } from './i18n'
import './index.css'
import { startUpdateChecks } from './lib/update'

// Register the service worker after the page is fully loaded so precaching
// never competes with first-paint resources.
const register = (): void => {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      // A long-open installed app never navigates, so nothing would re-check the
      // worker on its own — these periodic checks are what deliver new releases.
      if (registration) startUpdateChecks(registration)
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
void initI18n().then((lang) => {
  applyDocumentLanguage(lang)
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
