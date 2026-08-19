import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installSensitiveDraftStorageGuard } from './lib/sensitiveDraftStorage'
import './index.css'

installSensitiveDraftStorageGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
