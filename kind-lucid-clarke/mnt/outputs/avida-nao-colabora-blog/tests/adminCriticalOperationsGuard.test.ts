import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const facadePath = fileURLToPath(new URL('../src/components/admin/AdminUsers.tsx', import.meta.url))
const implPath = fileURLToPath(new URL('../src/components/admin/AdminUsersImpl.tsx', import.meta.url))

const facade = fs.readFileSync(facadePath, 'utf8')
const impl = fs.readFileSync(implPath, 'utf8')

test('operações críticas do Admin exigem confirmação explícita', () => {
  assert.match(facade, /window\.confirm/)
  assert.match(facade, /Alterar plano \(admin\)/)
  assert.match(facade, /Confirmar alteração/)
  assert.match(facade, /Agendar cancelamento/)
  assert.match(facade, /Redefinir senha/)
  assert.match(facade, /input#admin-toggle/)
})

test('operações críticas mantêm auditoria e feedback de sucesso ou erro', () => {
  assert.match(impl, /logAdminAction\('update', 'user_plan'/)
  assert.match(impl, /logAdminAction\('update', 'subscription_cancel'/)
  assert.match(impl, /logAdminAction\('update', 'user_password_reset'/)
  assert.match(impl, /logAdminAction\(isAdmin \? 'promote_admin' : 'revoke_admin'/)
  assert.match(impl, /setAdminSubMsg\(\{ type: 'ok'/)
  assert.match(impl, /setAdminSubMsg\(\{ type: 'err'/)
  assert.match(impl, /setAuthOpResult\(\{ type: 'ok'/)
  assert.match(impl, /setAuthOpResult\(\{ type: 'err'/)
  assert.match(impl, /window\.alert/)
})
