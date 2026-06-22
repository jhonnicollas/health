import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/senior-mode.css'
import './styles/high-contrast.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  ;(window as unknown as Record<string, unknown>).__hlInstallPrompt = event
})
