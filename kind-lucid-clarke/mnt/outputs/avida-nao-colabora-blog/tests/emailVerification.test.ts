import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { confirmationRedirectUrl, isEmailConfirmed, isEmailNotConfirmedError } from '../src/lib/authVerification.ts'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const readOuter = (path: string) => readFileSync(resolve(root, '../../../..', path), 'utf8')

test('confirmação de e-mail distingue usuários verificados de pendentes', () => {
  assert.equal(isEmailConfirmed({ email_confirmed_at: '2026-08-19T00:00:00Z' }), true)
  assert.equal(isEmailConfirmed({ confirmed_at: '2026-08-19T00:00:00Z' }), true)
  assert.equal(isEmailConfirmed({ email_confirmed_at: null, confirmed_at: null }), false)
  assert.equal(isEmailConfirmed(null), false)
})

test('erro de login por e-mail não confirmado é reconhecido sem depender só do texto', () => {
  assert.equal(isEmailNotConfirmedError({ code: 'email_not_confirmed', message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmedError({ message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmedError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false)
})

test('redirect de confirmação volta para a rota de login canônica', () => {
  assert.equal(
    confirmationRedirectUrl('https://www.avidanaocolabora.com/'),
    'https://www.avidanaocolabora.com/login?email_confirmed=1',
  )
})

test('configuração versionada do Supabase exige confirmação de e-mail', () => {
  const config = JSON.parse(read('supabase/auth-config.json')) as { mailer_autoconfirm?: boolean; uri_allow_list?: string }
  assert.equal(config.mailer_autoconfirm, false)
  assert.match(config.uri_allow_list ?? '', /www\.avidanaocolabora\.com\/\*\*/)
  assert.match(read('supabase/config.toml'), /\[auth\.email\][\s\S]*enable_confirmations\s*=\s*true/)
})

test('cadastro envia callback, oferece reenvio e não dispara boas-vindas antes da confirmação', () => {
  const auth = read('src/components/Auth.tsx')
  assert.match(auth, /emailRedirectTo:\s*confirmationRedirectUrl/)
  assert.match(auth, /supabase\.auth\.resend\(/)
  assert.match(auth, /type:\s*'signup'/)
  assert.match(auth, /email_confirmation_success/)
  assert.doesNotMatch(auth, /Conta criada com sucesso! Entrando/)
})

test('hook de autenticação não aceita sessão de e-mail pendente', () => {
  const hook = read('src/hooks/useAuth.ts')
  assert.match(hook, /isEmailConfirmed\(candidate\)/)
  assert.match(hook, /supabase\.auth\.signOut\(\)/)
})

test('configuração hosted de Auth é aplicada automaticamente na main e verificada', () => {
  const workflow = readOuter('.github/workflows/apply-supabase-auth-config.yml')
  const script = read('supabase/apply-auth-config.sh')
  assert.match(workflow, /SUPABASE_ACCESS_TOKEN/)
  assert.match(workflow, /auth-config\.json/)
  assert.match(workflow, /branches:\s*\[main\]/)
  assert.match(script, /mailer_autoconfirm/)
  assert.match(script, /Config de Auth aplicada e verificada/)
})

test('FAQ informa que novos cadastros precisam confirmar o e-mail', () => {
  const faq = read('src/components/FAQPage.tsx')
  assert.match(faq, /link de confirmação/i)
  assert.doesNotMatch(faq, /sem necessidade de confirmar e-mail/i)
})
