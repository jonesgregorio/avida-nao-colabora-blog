import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const auth = read('src/components/Auth.tsx')
const profile = read('src/components/Profile.tsx')
const forced = read('src/components/ForceChangePassword.tsx')
const adminUsers = read('src/components/admin/AdminUsersImpl.tsx')
const localConfig = read('supabase/config.toml')
const hostedConfig = JSON.parse(read('supabase/auth-config.json')) as { password_min_length?: number }
const applyAuthConfig = read('supabase/apply-auth-config.sh')

test('cadastro exige 8 caracteres sem bloquear login de credencial legada no HTML', () => {
  assert.match(auth, /if \(password\.length < 8\)/)
  assert.match(auth, /A senha deve ter pelo menos 8 caracteres\./)
  assert.match(auth, /minLength=\{isSignup \? 8 : undefined\}/)
  assert.match(auth, /minLength=\{8\}/)
  assert.match(auth, /placeholder=\{isSignup \? 'Mínimo 8 caracteres' : 'Sua senha'\}/)
  assert.doesNotMatch(auth, /minLength=\{6\}|Mínimo 6 caracteres|password\.length < 6/)
})

test('trocas de senha do usuário e do admin usam o mesmo mínimo de 8', () => {
  assert.match(profile, /newPassword\.length < 8/)
  assert.match(profile, /Nova senha \(mínimo 8 caracteres\)/)
  assert.match(profile, /minLength=\{8\}/)
  assert.doesNotMatch(profile, /newPassword\.length < 6|mínimo 6 caracteres|pelo menos 6 caracteres/)

  assert.match(forced, /password\.length < 8/)
  assert.match(adminUsers, /newPassword\.trim\(\)\.length < 8/)
})

test('Supabase local e hosted rejeitam novas senhas abaixo de 8', () => {
  assert.match(localConfig, /\[auth\][\s\S]*minimum_password_length\s*=\s*8/)
  assert.equal(hostedConfig.password_min_length, 8)
  assert.match(applyAuthConfig, /password_min_length/)
  assert.match(applyAuthConfig, /senha mínima de 8 caracteres/)
})
