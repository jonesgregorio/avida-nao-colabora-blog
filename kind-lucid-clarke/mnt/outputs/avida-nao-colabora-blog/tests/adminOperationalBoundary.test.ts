import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260909130000_operational_dashboard_single_source.sql')

test('a fronteira entre as duas RPCs operacionais está documentada', () => {
  assert.match(migration, /admin_queues_overview\(\)\s*=\s*ESTADO ATUAL/)
  assert.match(migration, /admin_operational_dashboard\(\)\s*=\s*M[ÉE]TRICAS DE PER[ÍI]ODO/)
  assert.match(migration, /comment on function public\.admin_operational_dashboard/i)
})

test('o bloco "attention" NÃO tem regra própria — deriva de admin_queues_overview()', () => {
  // consome o snapshot uma vez
  assert.match(migration, /v_snap := public\.admin_queues_overview\(\)/)
  // e lê os valores dele, sem recontar tabelas
  assert.match(migration, /'ai_errors_active',\s*coalesce\(\(v_snap #>> '\{failures_active,ai_errors\}'\)/)
  assert.match(migration, /'notifications_draft',\s*coalesce\(\(v_snap #>> '\{queues,notifications_draft\}'\)/)
  // o attention deriva o valor de ai_errors do snapshot, não recontando
  assert.match(migration, /'ai_errors_active',\s*coalesce\(\(v_snap #>> '\{failures_active,ai_errors\}'\)::int/)
  // não reconta support_tickets / guidance no attention (só no bloco period)
  const attentionBlock = migration.match(/-- Requer atenção[\s\S]*?into result/)?.[0] ?? ''
  assert.ok(attentionBlock.length > 100, 'bloco attention não localizado')
  assert.doesNotMatch(attentionBlock, /from public\.support_tickets/)
  assert.doesNotMatch(attentionBlock, /from public\.monthly_guidance_requests/)
})
