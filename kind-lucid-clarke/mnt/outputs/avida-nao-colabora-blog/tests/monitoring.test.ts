import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const monitoringSource = readFileSync(
  new URL('../src/lib/monitoring.tsx', import.meta.url),
  'utf8',
)
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')

test('monitoramento externo é opcional e restrito ao loader oficial do Sentry', () => {
  assert.match(monitoringSource, /VITE_SENTRY_LOADER_URL/)
  assert.match(monitoringSource, /url\.hostname === 'js\.sentry-cdn\.com'/)
  assert.match(monitoringSource, /if \(!loaderUrl\) return false/)
})

test('monitoramento remove dados pessoais e breadcrumbs de console antes do envio', () => {
  assert.match(monitoringSource, /delete event\.user/)
  assert.match(monitoringSource, /delete event\.request\.data/)
  assert.match(monitoringSource, /delete event\.request\.cookies/)
  assert.match(monitoringSource, /breadcrumb\.category !== 'console'/)
  assert.match(monitoringSource, /stripQueryAndHash/)
})

test('aplicação inicializa monitoramento antes de montar o React e possui Error Boundary', () => {
  const initIndex = mainSource.indexOf('initExternalMonitoring()')
  const renderIndex = mainSource.indexOf('createRoot(')
  assert.ok(initIndex >= 0 && initIndex < renderIndex)
  assert.match(mainSource, /<MonitoringErrorBoundary>/)
  assert.match(mainSource, /<App \/>/)
})

test('arquivo de exemplo documenta somente configuração pública do Sentry', () => {
  assert.match(envExample, /VITE_SENTRY_LOADER_URL=/)
  assert.match(envExample, /SENTRY_AUTH_TOKEN/)
  assert.match(envExample, /Não adicione[^\n]*SENTRY_AUTH_TOKEN/)
})
