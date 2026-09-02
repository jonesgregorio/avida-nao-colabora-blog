import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('P3.20 mantém MFA opcional para usuário comum e exige TOTP apenas quando já há fator verificado', () => {
  const gate = read('src/components/user/UserMfaGate.tsx')
  const settings = read('src/components/user/UserMfaSettings.tsx')
  const layout = read('src/components/user/UserLayout.tsx')

  assert.match(gate, /factor\.status === 'verified'/)
  assert.match(gate, /currentLevel === 'aal2'/)
  assert.match(gate, /mfa\.challenge\(/)
  assert.match(gate, /mfa\.verify\(/)
  assert.match(gate, /if \(!verifiedFactorId \|\| aal\?\.currentLevel === 'aal2'\)/)

  assert.match(settings, /Opcional\./)
  assert.match(settings, /mfa\.enroll\(/)
  assert.match(settings, /factorType: 'totp'/)
  assert.match(settings, /mfa\.unenroll\(/)
  assert.match(settings, /A conta continua funcionando normalmente sem MFA/)

  assert.match(layout, /const mfaGate = useUserMfaGate\(user, onSignOut\)/)
  assert.match(layout, /if \(mfaGate\) return/)
  assert.match(layout, /currentView === 'profile'/)
  assert.match(layout, /<UserMfaSettings user=\{user\} \/>/)
})

test('P3.20 não substitui nem enfraquece o MFA administrativo já obrigatório', () => {
  const adminGate = read('src/components/admin/AdminMfaGate.tsx')
  const adminPolicy = read('supabase/migrations/20260819222500_auth_p0_hardening.sql')

  assert.match(adminGate, /O painel administrativo exige senha \+ código TOTP/)
  assert.match(adminGate, /currentLevel === 'aal2'/)
  assert.match(adminPolicy, /O usuário comum continua com AAL1/)
  assert.match(adminPolicy, /COALESCE\(auth\.jwt\(\)->>'aal', 'aal1'\) = 'aal2'/)
})

test('P3.20 cobre recuperação de senha porque o gate roda antes de renderizar qualquer UserLayout', () => {
  const app = read('src/App.tsx')
  const layout = read('src/components/user/UserLayout.tsx')

  assert.match(app, /if \(user && profile\?\.must_change_password\)/)
  assert.match(app, /return <ForceChangePassword userId=\{user\.id\} onDone=\{refreshProfile\} \/>/)
  assert.match(layout, /const mfaGate = useUserMfaGate\(user, onSignOut\)/)
  assert.match(layout, /if \(mfaGate\) return/)
})
