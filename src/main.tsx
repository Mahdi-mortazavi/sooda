import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import i18n, { applyDocumentLanguage } from './i18n'
import './index.css'
import type { AppLanguage } from './lib/numbers'

applyDocumentLanguage(i18n.language as AppLanguage)

// Register the service worker after the page is fully loaded so precaching
// never competes with first-paint resources.
if (document.readyState === 'complete') {
  registerSW({ immediate: true })
} else {
  window.addEventListener('load', () => registerSW({ immediate: true }), { once: true })
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
