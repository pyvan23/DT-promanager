import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applySkin, readSkin } from './ui/skin'

// Before the first paint, so the chosen skin never flashes the other one.
applySkin(readSkin())
import { requestPersistentStorage } from './pwa/install'
import { PwaUpdate } from './pwa/PwaUpdate'

// On the first tap (Firefox shows a permission prompt; it reads better after a gesture).
window.addEventListener('pointerdown', requestPersistentStorage, { once: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaUpdate />
  </StrictMode>,
)
