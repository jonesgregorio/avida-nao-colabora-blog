import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const monitoringSource = readFileSync(
  new URL('../src/lib/monitoring.tsx', import.meta.url),
  'utf8',
)
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const vercelConfig = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')

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

test('recuperação de chunk velho recarrega uma única vez com guarda de sessão', () => {
  assert.match(monitoringSource, /Failed to fetch dynamically imported module/)
  assert.match(monitoringSource, /vite:preloadError/)
  assert.match(monitoringSource, /sessionStorage\.getItem\(STALE_CHUNK_FLAG\)/)
  assert.match(monitoringSource, /isModuleLoadError\(error\) && recoverFromStaleChunk\(\)/)
  assert.match(mainSource, /installStaleChunkRecovery\(\)/)
})

test('SPA fallback da Vercel não intercepta /assets/ (evita cache imutável envenenado)', () => {
  assert.match(vercelConfig, /"source": "\/\(\(\?!assets\/\)\.\*\)", "destination": "\/index\.html"/)
  assert.doesNotMatch(vercelConfig, /"source": "\/\(\.\*\)", "destination": "\/index\.html"/)
})

test('arquivo de exemplo documenta somente configuração pública do Sentry', () => {
  assert.match(envExample, /VITE_SENTRY_LOADER_URL=/)
  assert.match(envExample, /SENTRY_AUTH_TOKEN/)
  assert.match(envExample, /Não adicione[^\n]*SENTRY_AUTH_TOKEN/)
})
