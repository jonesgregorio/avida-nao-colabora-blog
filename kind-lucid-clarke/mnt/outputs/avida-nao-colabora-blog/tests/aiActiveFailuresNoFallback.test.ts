import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260909140000_ai_active_failures_exclude_fallback.sql')
const shared = read('src/lib/adminOperationalStatus.ts')
const aiUsage = read('src/components/admin/AdminAIUsage.tsx')
const overview = read('src/components/admin/AdminOverview.tsx')
const layout = read('src/components/admin/AdminLayout.tsx')
const queuesFailures = read('src/components/admin/AdminQueuesFailures.tsx')

test('fallback NÃO é mais falha ativa de IA (só error/failed), mas segue no histórico 24h', () => {
  assert.match(migration, /create or replace function public\.admin_queues_overview\(\)/i)
  // failures_active.ai_errors: última geração da entidade com error/failed — sem fallback
  assert.match(
    migration,
    /'ai_errors', \(select count\(\*\) from latest_ai\s*\n\s*where outcome in \('error','failed'\) and created_at > v_now - interval '30 days'\)/,
  )
  assert.doesNotMatch(
    migration,
    /from latest_ai\s*\n\s*where outcome in \('error','failed','fallback'\)/,
  )
  // failures_24h ainda inclui fallback como contexto
  assert.match(migration, /failures_24h[\s\S]*?'ai_errors', \(select count\(\*\) from public\.ai_generation_logs where lower\(coalesce\(generation_status, status\)\) in \('error','failed','fallback'\)/)
  // admin-only e sem acesso anon
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /revoke all on function public\.admin_queues_overview\(\) from public, anon/i)
})

test('abrir "Uso de IA" a partir de um alerta de falha pré-filtra Status = Erro', () => {
  assert.match(shared, /export const AI_USAGE_STATUS_KEY = 'admin-ai-usage-status'/)
  assert.match(shared, /export function markAiFailuresDeepLink\(\)/)
  assert.match(shared, /export function consumeAiUsageStatusPreset\(\)/)
  // a tela consome o preset no mount (one-shot)
  assert.match(aiUsage, /useState\(\(\) => consumeAiUsageStatusPreset\(\) \?\? 'todos'\)/)
  // os pontos de navegação marcam o deep-link
  assert.match(overview, /before: markAiFailuresDeepLink/)
  assert.match(layout, /if \(item\.key === 'ai'\) markAiFailuresDeepLink\(\)/)
})

test('a tela "Filas e falhas" explica que fallback não é falha ativa', () => {
  assert.match(queuesFailures, /fallback.*não.*falha ativa|não como falha ativa/i)
})
