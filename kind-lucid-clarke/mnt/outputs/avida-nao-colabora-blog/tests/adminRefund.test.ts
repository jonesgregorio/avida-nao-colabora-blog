import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8')

const migration = read('supabase/migrations/20260903140000_stripe_refunds_audit.sql')
const fn = read('supabase/functions/admin-refund/index.ts')
const ui = read('src/components/admin/AdminRefund.tsx')
const financeiro = read('src/components/admin/AdminFinanceiro.tsx')

test('migration só cria a tabela de auditoria, admin-only, sem tocar cobrança', () => {
  assert.match(migration, /create table if not exists public\.stripe_refunds/i)
  assert.match(migration, /alter table public\.stripe_refunds enable row level security/i)
  assert.match(migration, /using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i)
  assert.match(migration, /revoke all on public\.stripe_refunds from anon/i)
  assert.doesNotMatch(migration, /subscriptions|create-checkout|stripe_webhook_events|price/i)
})

test('a Edge Function tem as travas: AAL2, motivo, teto, confirmação em 2 etapas', () => {
  assert.match(fn, /requireAdminAal2\(req\)/)
  assert.match(fn, /if \(!body\.confirm\) \{\s*return json\(\{ preview: info/)
  assert.match(fn, /reason\.length < 5/)
  assert.match(fn, /MAX_CENTS/)
  assert.match(fn, /amount > info\.refundable/)
  assert.match(fn, /idempotencyKey: `admin-refund-/)
  assert.match(fn, /from\('stripe_refunds'\)\s*\.insert/)
  // registra quem fez e por quê no metadata do Stripe
  assert.match(fn, /metadata: \{ admin_id: auth\.user\.id, admin_reason:/)
})

test('a Edge Function não altera assinatura/preço/webhook', () => {
  assert.doesNotMatch(fn, /subscriptions\.(update|create|cancel)|prices\.|webhookEndpoints|schedules\./)
  assert.match(fn, /stripe\.refunds\.create/)
})

test('o painel exige preview → motivo → digitar REEMBOLSAR', () => {
  assert.match(ui, /supabase\.functions\.invoke\('admin-refund', \{ body: \{ id: id\.trim\(\) \} \}\)/)
  assert.match(ui, /confirm: true/)
  assert.match(ui, /toUpperCase\(\) === 'REEMBOLSAR'/)
  assert.match(ui, /reason\.trim\(\)\.length >= 5/)
  assert.match(ui, /overCap|teto por operação/)
  assert.match(financeiro, /import AdminRefund/)
  assert.match(financeiro, /<AdminRefund \/>/)
})

test('admin-refund está na lista de Edge Functions conhecidas', () => {
  assert.match(read('tests/edgeFunctionsDenoCoverage.test.ts'), /'admin-refund'/)
})
