import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initExternalMonitoring, installStaleChunkRecovery, MonitoringErrorBoundary } from './lib/monitoring'
import { installSensitiveDraftStorageGuard } from './lib/sensitiveDraftStorage'
import { installSpeechRecognitionPermissionGuard } from './lib/speechRecognitionPermission'
import './index.css'
import './diary-mobile.css'

initExternalMonitoring()
installStaleChunkRecovery()
installSensitiveDraftStorageGuard()
installSpeechRecognitionPermissionGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MonitoringErrorBoundary>
      <App />
    </MonitoringErrorBoundary>
  </StrictMode>,
)
