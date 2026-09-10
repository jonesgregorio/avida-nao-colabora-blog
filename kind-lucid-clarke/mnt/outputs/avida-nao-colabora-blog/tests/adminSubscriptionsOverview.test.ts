import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260909100000_admin_subscriptions_overview.sql')
const fixMigration = read('supabase/migrations/20260909214500_fix_admin_subscriptions_provider_subscription_id.sql')
const comp = read('src/components/admin/AdminAssinaturasOverview.tsx')

test('a RPC separa "usuário em plano" (profiles) de "assinatura Stripe ativa"', () => {
  assert.match(migration, /create or replace function public\.admin_subscriptions_overview\(\)/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /set search_path = public, auth/i)
  assert.match(migration, /revoke all on function public\.admin_subscriptions_overview\(\) from public, anon/i)
  // usa profiles.plan para "usuários" e user_subscriptions.payment_status para Stripe
  assert.match(migration, /'users_by_plan'/)
  assert.match(migration, /coalesce\(s\.payment_status, s\.status/)
  assert.match(migration, /'divergences'/)
  assert.match(migration, /paid_profile_no_active_stripe/)
})

test('a correção usa o identificador que existe no schema atual de user_subscriptions', () => {
  assert.match(fixMigration, /create or replace function public\.admin_subscriptions_overview\(\)/i)
  assert.match(fixMigration, /s\.provider_subscription_id/i)
  assert.match(fixMigration, /su\.provider_subscription_id/i)
  assert.doesNotMatch(fixMigration, /s\.stripe_subscription_id/i)
  assert.doesNotMatch(fixMigration, /su\.stripe_subscription_id/i)
  assert.match(fixMigration, /if not public\.is_admin\(\) then/i)
  assert.match(fixMigration, /set search_path = public, auth/i)
  assert.match(fixMigration, /revoke all on function public\.admin_subscriptions_overview\(\) from public, anon/i)
  assert.match(fixMigration, /grant execute on function public\.admin_subscriptions_overview\(\) to authenticated/i)
})

test('a tela NÃO transforma erro de RPC em zero', () => {
  // sem catch { return 0 } para métrica administrativa
  assert.doesNotMatch(comp, /catch\s*\{\s*return 0\s*\}/)
  // erro real vai para o state e é exibido
  assert.match(comp, /setErr\(/)
  assert.match(comp, /os números abaixo NÃO representam o estado real/)
  // métrica sem dado mostra "Indisponível", não 0
  assert.match(comp, /value == null \? \(\s*\n\s*<p className="font-serif text-lg text-red-500 mt-1">Indisponível<\/p>/)
})

test('rótulo preciso: "Usuários em plano (perfil)" e "Assinaturas Stripe" separados', () => {
  assert.match(comp, /Usuários em plano \(perfil\)/)
  assert.match(comp, /Assinaturas Stripe/)
  assert.doesNotMatch(comp, /Assinaturas pagas/)
  assert.match(comp, /Divergências de assinatura/)
  assert.match(comp, /admin_subscription_divergences/)
})
