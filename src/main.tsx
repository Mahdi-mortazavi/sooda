import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import i18n, { applyDocumentLanguage } from './i18n'
import './index.css'
import type { AppLanguage } from './lib/numbers'

applyDocumentLanguage(i18n.language as AppLanguage)

registerSW({ immediate: true })

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
