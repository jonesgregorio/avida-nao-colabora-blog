import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { googleErrorMessage, googleRedirectUrl, isNewOAuthUser } from '../src/lib/googleAuthRules.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const auth = read('src/components/Auth.tsx')
const lib = read('src/lib/googleAuth.ts')

test('a URL de retorno do Google fica numa rota já liberada no Auth do Supabase', () => {
  assert.equal(googleRedirectUrl('https://www.avidanaocolabora.com'), 'https://www.avidanaocolabora.com/login?oauth=google')
  assert.equal(googleRedirectUrl('https://avidanaocolabora.com/'), 'https://avidanaocolabora.com/login?oauth=google')
  const config = JSON.parse(read('supabase/auth-config.json')) as { uri_allow_list: string }
  const allowed = config.uri_allow_list.split(',')
  assert.ok(allowed.includes('https://www.avidanaocolabora.com/**'))
  assert.ok(allowed.includes('https://avidanaocolabora.com/**'))
})

test('cadastro novo = conta criada e primeiro acesso no mesmo instante; conta antiga nunca é nova', () => {
  const now = Date.parse('2026-10-01T12:00:00Z')
  assert.equal(isNewOAuthUser({ created_at: '2026-10-01T11:59:40Z', last_sign_in_at: '2026-10-01T11:59:41Z' }, now), true)
  // já tinha conta e entrou com o Google (vinculação): criada há dias
  assert.equal(isNewOAuthUser({ created_at: '2026-09-18T19:12:03Z', last_sign_in_at: '2026-10-01T11:59:50Z' }, now), false)
  // conta criada há muito tempo mesmo com os dois carimbos iguais
  assert.equal(isNewOAuthUser({ created_at: '2026-09-30T10:00:00Z', last_sign_in_at: '2026-09-30T10:00:01Z' }, now), false)
  assert.equal(isNewOAuthUser({ created_at: undefined, last_sign_in_at: undefined }, now), false)
  assert.equal(isNewOAuthUser({ created_at: 'x', last_sign_in_at: 'y' }, now), false)
})

test('mensagens de erro do retorno do Google são amigáveis e tratam conta bloqueada', () => {
  assert.match(googleErrorMessage('User is banned'), /bloqueada/)
  assert.match(googleErrorMessage('access_denied'), /cancelado/)
  assert.match(googleErrorMessage('qualquer coisa'), /Não foi possível entrar com o Google/)
  assert.match(googleErrorMessage(null), /Não foi possível/)
})

test('o botão só aparece quando o provedor Google está ligado no Supabase', () => {
  assert.match(lib, /\/auth\/v1\/settings/)
  assert.match(lib, /settings\.external\?\.google === true/)
  assert.match(auth, /\{googleReady && mode !== 'reset' && \(/)
  assert.match(auth, /Cadastrar com o Google/)
  assert.match(auth, /Entrar com o Google/)
  // consentimento: o aviso de Termos/Privacidade acompanha o botão
  assert.match(auth, /Ao continuar com o Google você concorda com os/)
})

test('o retorno do Google registra o cadastro novo uma vez e segue para a área logada', () => {
  assert.match(auth, /if \(query\.get\('oauth'\) !== 'google'\) return undefined/)
  assert.match(auth, /if \(isNewOAuthUser\(user\)\)/)
  assert.match(auth, /trackEvent\('register_success'/)
  assert.match(auth, /trackEvent\('registration_complete'/)
  assert.match(auth, /trackMetaCompleteRegistration\(user\.id\)/)
  assert.match(auth, /void emailWelcome\(user\.id, targetEmail,/)
  assert.match(auth, /trackEvent\('login_success', \{ user_id: user\.id, metadata: \{ location: 'auth', method: 'google' \} \}\)/)
  assert.match(auth, /onBackRef\.current\(\)/)
  // o efeito da confirmação por e-mail não pode tratar o retorno do Google como erro de confirmação
  assert.match(auth, /if \(query\.get\('oauth'\) === 'google'\) return \/\/ retorno do Google/)
})

test('o App espera o retorno do Google terminar antes de navegar (mesma corrida da confirmação de e-mail)', () => {
  const app = read('src/App.tsx')
  assert.match(app, /query\.get\('email_confirmed'\) === '1' \|\| query\.has\('error'\) \|\| query\.get\('oauth'\) === 'google'/)
})

test('nenhum segredo do Google entra no código nem na documentação', () => {
  const doc = read('docs/LOGIN_GOOGLE.md')
  for (const text of [auth, lib, doc]) {
    assert.doesNotMatch(text, /GOCSPX-[A-Za-z0-9_-]{10,}/)
    assert.doesNotMatch(text, /\d{9,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com/)
  }
  assert.match(doc, /Nunca coloque o Client Secret no código/)
})
