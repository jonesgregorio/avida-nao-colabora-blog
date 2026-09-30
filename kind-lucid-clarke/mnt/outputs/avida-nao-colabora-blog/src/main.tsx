import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import MarketingConsentBanner from './components/MarketingConsentBanner'
import { initExternalMonitoring, installStaleChunkRecovery, MonitoringErrorBoundary } from './lib/monitoring'
import { installSensitiveDraftStorageGuard } from './lib/sensitiveDraftStorage'
import { installSpeechRecognitionPermissionGuard } from './lib/speechRecognitionPermission'
import { initArticleActiveTimeTracking } from './lib/articleActiveTime'
import { initAdminSupportComposerEnhancements } from './lib/adminSupportComposerEnhancements'
import './index.css'
import './diary-mobile.css'

initExternalMonitoring()
installStaleChunkRecovery()
installSensitiveDraftStorageGuard()
installSpeechRecognitionPermissionGuard()
initArticleActiveTimeTracking()
initAdminSupportComposerEnhancements()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MonitoringErrorBoundary>
      <App />
      <MarketingConsentBanner />
    </MonitoringErrorBoundary>
  </StrictMode>,
)
