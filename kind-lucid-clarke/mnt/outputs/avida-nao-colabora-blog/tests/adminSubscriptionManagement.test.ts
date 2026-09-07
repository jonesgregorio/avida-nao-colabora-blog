import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const fn = read('supabase/functions/admin-subscription/index.ts')
const migration = read('supabase/migrations/20260907230000_admin_courtesy_days.sql')
const actions = read('src/components/admin/AdminSubscriptionActions.tsx')
const panel = read('src/components/admin/AdminSubscriptionPanel.tsx')

test('a Edge Function exige admin AAL2 e não expõe segredo', () => {
  assert.match(fn, /requireAdminAal2/)
  assert.match(fn, /if \(!auth\.ok\) return json\(\{ error: auth\.error \}/)
  assert.doesNotMatch(fn, /sk_live_|sk_test_[A-Za-z0-9]|whsec_[A-Za-z0-9]/)
})

test('cancelamento é sempre para o fim do ciclo, nunca imediato', () => {
  assert.match(fn, /cancel_at_period_end: value/)
  assert.doesNotMatch(fn, /\.subscriptions\.cancel\(/)
  assert.doesNotMatch(fn, /invoice_now|prorate: true|cancellation immediate/i)
})

test('sync apenas espelha o Stripe para o banco (idempotente)', () => {
  assert.match(fn, /action === 'sync'/)
  assert.match(fn, /from\('user_subscriptions'\)\.update\(patch\)/)
  // O bloco sync monta um patch a partir do estado lido do Stripe — não escreve no Stripe.
  const syncBlock = fn.slice(fn.indexOf("if (action === 'sync')"), fn.indexOf("if (action === 'set_cancel_at_period_end')"))
  assert.doesNotMatch(syncBlock, /stripe\.subscriptions\.update\(/)
})

test('toda ação é auditada em admin_logs', () => {
  assert.match(fn, /from\('admin_logs'\)\.insert\(\{/)
  assert.match(fn, /action: 'config',\s*\n\s*target_type: 'subscription'/)
})

test('conceder dias de cortesia estende o acesso sem tocar no plano nem no Stripe', () => {
  assert.match(migration, /create or replace function public\.admin_grant_courtesy_days\(/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /v_days\s+integer\s*:=\s*least\(greatest\(coalesce\(p_days, 0\), 1\), 365\)/i)
  assert.match(migration, /v_base\s*:=\s*greatest\(now\(\), coalesce\(v_prev, now\(\)\)\)/i)
  assert.doesNotMatch(migration, /update public\.profiles set[\s\S]*?\bplan\b\s*=/i)
  assert.match(migration, /revoke all on function public\.admin_grant_courtesy_days\(uuid, integer, text\) from public, anon/i)
})

test('a tela confirma cada ação e chama a Edge Function correta', () => {
  assert.match(actions, /functions\.invoke\('admin-subscription'/)
  assert.match(actions, /window\.confirm\(/)
  assert.match(actions, /supabase\.rpc\('admin_grant_courtesy_days'/)
  assert.match(actions, /logAdminAction\('config', 'subscription_/)
  assert.match(panel, /<AdminSubscriptionActions/)
})
