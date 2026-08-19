import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helper = readFileSync(new URL('../supabase/functions/_shared/adminAuth.ts', import.meta.url), 'utf8')
const discount = readFileSync(new URL('../supabase/functions/admin-discount/index.ts', import.meta.url), 'utf8')
const webhook = readFileSync(new URL('../supabase/functions/configure-stripe-webhook/index.ts', import.meta.url), 'utf8')
const cancellation = readFileSync(new URL('../supabase/functions/admin-schedule-cancellation/index.ts', import.meta.url), 'utf8')

test('helper valida JWT antes de confiar no claim AAL', () => {
  const verifyPos = helper.indexOf('auth.getUser(token)')
  const aalPos = helper.indexOf('aalFromVerifiedJwt(token)')
  assert.ok(verifyPos >= 0, 'JWT precisa ser validado no Supabase Auth')
  assert.ok(aalPos > verifyPos, 'claim AAL só pode ser lido depois de validar o JWT')
})

test('helper exige role admin e AAL2', () => {
  assert.match(helper, /role\?: string/)
  assert.match(helper, /role !== 'admin'/)
  assert.match(helper, /aalFromVerifiedJwt\(token\) !== 'aal2'/)
  assert.match(helper, /MFA obrigatório/)
})

for (const [name, source] of [
  ['admin-discount', discount],
  ['configure-stripe-webhook', webhook],
  ['admin-schedule-cancellation', cancellation],
] as const) {
  test(`${name} usa autorização administrativa AAL2 centralizada`, () => {
    assert.match(source, /requireAdminAal2/)
    assert.match(source, /const auth = await requireAdminAal2\(req\)/)
    assert.doesNotMatch(source, /select\('role'\)/)
  })
}

test('ações financeiras preservam o ID do admin autenticado na auditoria', () => {
  assert.match(discount, /const user = auth\.user/)
  assert.match(discount, /concedido_por: user\.id/)
  assert.match(cancellation, /const user = auth\.user/)
  assert.match(cancellation, /admin_id: user\.id/)
})
