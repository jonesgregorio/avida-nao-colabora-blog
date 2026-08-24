import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initExternalMonitoring, MonitoringErrorBoundary } from './lib/monitoring'
import { installSensitiveDraftStorageGuard } from './lib/sensitiveDraftStorage'
import { installSpeechRecognitionPermissionGuard } from './lib/speechRecognitionPermission'
import './index.css'

initExternalMonitoring()
installSensitiveDraftStorageGuard()
installSpeechRecognitionPermissionGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MonitoringErrorBoundary>
      <App />
    </MonitoringErrorBoundary>
  </StrictMode>,
)
