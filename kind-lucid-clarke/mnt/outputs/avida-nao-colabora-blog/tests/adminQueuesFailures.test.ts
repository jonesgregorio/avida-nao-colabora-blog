import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260907180000_admin_queues_and_reprocess.sql')
const comp = read('src/components/admin/AdminQueuesFailures.tsx')
const area = read('src/components/admin/AdminAreaSistema.tsx')

test('RPCs de filas e reprocesso são admin-only e não expostas a anon', () => {
  assert.match(migration, /create or replace function public\.admin_queues_overview\(\)/i)
  assert.match(migration, /create or replace function public\.admin_requeue_overdue_personalization\(\)/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /revoke all on function public\.admin_queues_overview\(\) from public, anon/i)
  assert.match(migration, /revoke all on function public\.admin_requeue_overdue_personalization\(\) from public, anon/i)
  // Não redefine automações nem a métrica da Saúde do Sistema.
  assert.doesNotMatch(migration, /create or replace function public\.get_operational_metrics/i)
  assert.doesNotMatch(migration, /cron\.alter_job|cron\.schedule/i)
})

test('o reprocesso de personalização é idempotente: só overdue sem rascunho/entrega vira pending', () => {
  assert.match(migration, /update public\.user_personalization_tasks\s*\n?\s*set status = 'pending'/i)
  assert.match(migration, /where status = 'overdue'\s*\n?\s*and delivery_id is null\s*\n?\s*and generated_at is null/i)
  assert.match(migration, /returning id/i)
})

test('admin_queues_overview traz filas + falhas 24h e é só contagem', () => {
  for (const k of ['personalization_overdue', 'reports_building', 'notifications_draft', 'webhooks_stuck']) {
    assert.match(migration, new RegExp(`'${k}'`), `fila ${k} ausente`)
  }
  for (const k of ['reports_failed', 'emails_failed', 'ai_errors', 'webhooks_failed']) {
    assert.match(migration, new RegExp(`'${k}'`), `falha ${k} ausente`)
  }
  assert.doesNotMatch(migration, /full_name|email\b|\.text\b|free_note/i)
})

test('a aba "Filas e falhas" entra no Sistema sem remover as abas existentes', () => {
  assert.match(area, /\{ id: 'filas', label: 'Filas e falhas'/)
  assert.match(area, /tab === 'filas' && <AdminQueuesFailures \/>/)
  assert.match(area, /\{ id: 'saude', label: 'Saúde do sistema'/)
  assert.match(area, /\{ id: 'automacoes', label: 'Automações'/)
})

test('a tela registra a ação de reprocesso na auditoria e confirma antes', () => {
  assert.match(comp, /supabase\.rpc\('admin_queues_overview'\)/)
  assert.match(comp, /supabase\.rpc\('admin_requeue_overdue_personalization'\)/)
  assert.match(comp, /window\.confirm\(/)
  assert.match(comp, /logAdminAction\('config', 'queue_reprocess'/)
  assert.match(comp, /admin_queues_overview\|does not exist\|schema cache/)
})
