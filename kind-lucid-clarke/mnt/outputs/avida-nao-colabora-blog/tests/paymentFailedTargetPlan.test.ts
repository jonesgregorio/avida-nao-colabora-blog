import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const source = fs.readFileSync(new URL('supabase/functions/send-transactional-email/index.ts', root), 'utf8')

test('payment_failed usa o plano de destino da assinatura, não o plano atual do perfil', () => {
  assert.match(source, /payload\.template_key === 'payment_failed'/)
  assert.match(source, /from\('user_subscriptions'\)/)
  assert.match(source, /select\('plan_key'\)/)
  assert.match(source, /effectiveVariables\.plano = label/)
  assert.match(source, /metadata: \{ variables: effectiveVariables/)
  assert.match(source, /const vars = effectiveVariables/)
})

test('normaliza nomes comerciais atuais e legados sem expor free como destino pago', () => {
  assert.match(source, /essential.*Essencial/)
  assert.match(source, /therapeutic.*Plus/)
  assert.doesNotMatch(source, /effectiveVariables\.plano\s*=\s*['"](?:free|Gratuito)['"]/)
})
