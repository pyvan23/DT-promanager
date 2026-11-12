import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
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
