import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isSensitiveDraftKey } from '../src/lib/sensitiveDraftStorage.ts'

test('identifica somente as chaves de rascunho sensível conhecidas', () => {
  assert.equal(isSensitiveDraftKey('contact_draft'), true)
  assert.equal(isSensitiveDraftKey('avnc-support-draft-ticket-123'), true)
  assert.equal(isSensitiveDraftKey('avnc-guidance-draft-request-456'), true)

  assert.equal(isSensitiveDraftKey('admin_active_area'), false)
  assert.equal(isSensitiveDraftKey('ai_active_provider'), false)
  assert.equal(isSensitiveDraftKey('analytics_session_id'), false)
})

test('guard é instalado antes do React e logout limpa os rascunhos sensíveis', () => {
  const main = fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
  const auth = fs.readFileSync(new URL('../src/hooks/useAuth.ts', import.meta.url), 'utf8')

  assert.match(main, /installSensitiveDraftStorageGuard\(\)/)
  assert.match(auth, /event === 'SIGNED_OUT'.*clearSensitiveDrafts\(\)/)
  assert.match(auth, /finally\s*\{[\s\S]*clearSensitiveDrafts\(\)/)
})
