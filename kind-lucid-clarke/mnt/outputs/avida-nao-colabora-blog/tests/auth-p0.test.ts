import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260819222500_auth_p0_hardening.sql', import.meta.url), 'utf8')
const useAuth = readFileSync(new URL('../src/hooks/useAuth.ts', import.meta.url), 'utf8')
const gate = readFileSync(new URL('../src/components/admin/AdminMfaGate.tsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../src/components/admin/index.tsx', import.meta.url), 'utf8')
const forcedPassword = readFileSync(new URL('../src/components/ForceChangePassword.tsx', import.meta.url), 'utf8')

test('recuperação de senha termina em troca obrigatória de senha', () => {
  assert.match(useAuth, /event === 'PASSWORD_RECOVERY'/)
  assert.match(useAuth, /rpc\('mark_password_recovery_required'\)/)
  assert.match(migration, /must_change_password = true/)
  assert.match(forcedPassword, /auth\.updateUser\(\{ password \}\)/)
  assert.match(forcedPassword, /rpc\('clear_must_change_password'\)/)
})

test('admin exige AAL2 também no banco', () => {
  assert.match(migration, /auth\.jwt\(\)->>'aal'/)
  assert.match(migration, /'aal2'/)
  assert.match(migration, /profiles\.role = 'admin'/)
})

test('gate administrativo cadastra e verifica TOTP antes do painel', () => {
  assert.match(gate, /mfa\.getAuthenticatorAssuranceLevel\(\)/)
  assert.match(gate, /mfa\.listFactors\(\)/)
  assert.match(gate, /mfa\.enroll\(\{/)
  assert.match(gate, /factorType: 'totp'/)
  assert.match(gate, /mfa\.challenge\(\{ factorId \}\)/)
  assert.match(gate, /mfa\.verify\(\{/)
  assert.match(admin, /if \(!mfaVerified\)/)
  assert.match(admin, /<AdminMfaGate/)
})

test('login administrativo só é auditado após MFA', () => {
  assert.match(admin, /profile\?\.role === 'admin' && mfaVerified/)
})
