import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const email = readFileSync(new URL('../supabase/functions/send-transactional-email/index.ts', import.meta.url), 'utf8')

test('service role continua autorizado sem passar pelo MFA de usuário', () => {
  assert.match(email, /const isService = token && token === SERVICE_KEY/)
  assert.match(email, /if \(!isService\)/)
})

test('self-service continua limitado a templates permitidos e ao próprio e-mail', () => {
  assert.match(email, /SELF_SERVICE\.has\(payload\.template_key\)/)
  assert.match(email, /payload\.to_email\.toLowerCase\(\) === \(user\.email \?\? ''\)\.toLowerCase\(\)/)
})

test('envio administrativo privilegiado exige AAL2', () => {
  assert.match(email, /requireAdminAal2/)
  assert.match(email, /profile\?\.role === 'admin' && !isSelf/)
  assert.match(email, /const privileged = await requireAdminAal2\(req\)/)
  assert.match(email, /if \(!privileged\.ok\) return json\(\{ error: privileged\.error \}, privileged\.status\)/)
})

test('nenhum log ou chamada ao Resend ocorre antes da autorização', () => {
  const authPos = email.indexOf('requireAdminAal2(req)')
  const logPos = email.indexOf("from('email_logs')")
  const resendPos = email.indexOf("fetch('https://api.resend.com/emails'")
  assert.ok(authPos >= 0 && logPos > authPos)
  assert.ok(resendPos > authPos)
})
