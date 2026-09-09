import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260908190000_admin_queues_incident_key.sql')
const entityMigration = read('supabase/migrations/20260909110000_ai_incident_entity_key.sql')
const layout = read('src/components/admin/AdminLayout.tsx')
const overview = read('src/components/admin/AdminOverview.tsx')
const shared = read('src/lib/adminOperationalStatus.ts')

test('admin_queues_overview NÃO depende de notifications.status', () => {
  // A coluna notifications.status não existe em produção (ver 20260907290000).
  assert.doesNotMatch(migration, /from\s+public\.notifications\b/i)
  assert.doesNotMatch(migration, /notifications\s+where\s+[^;]*status/i)
  // Fonte correta: admin_communications.status = 'draft'
  assert.match(migration, /notifications_draft',\s*\(select count\(\*\) from public\.admin_communications where status = 'draft'\)/)
})

test('incidente de IA é agrupado por entidade (incident_entity_key) com fallback composto', () => {
  // A chave passou a ser incident_entity_key; linhas antigas caem no composto.
  assert.match(entityMigration, /add column if not exists incident_entity_key text/i)
  assert.match(entityMigration, /nullif\(btrim\(incident_entity_key\), ''\)/)
  assert.match(entityMigration, /coalesce\(content_type, 'generic'\)\s*\n\s*\|\| ':u:' \|\| coalesce\(user_id::text, '-'\)\s*\n\s*\|\| ':p:' \|\| coalesce\(source_period_start::text, '-'\)/)
  // Fallback determinístico também conta como incidente ativo até um sucesso real.
  assert.match(entityMigration, /outcome in \('error','failed','fallback'\)/)
  assert.match(entityMigration, /create index if not exists ai_generation_logs_entity_incident/i)
})

test('o badge do sino carrega no mount e atualiza em intervalo, sem depender de clique', () => {
  // useEffect que dispara loadAlerts ao montar + setInterval moderado.
  assert.match(layout, /useEffect\(\(\) => \{\s*void loadAlerts\(\)/s)
  assert.match(layout, /setInterval\(\(\) => \{ void loadAlerts\(\) \}, 180_000\)/)
  // Estado desconhecido nunca é exibido como "0 = sem problemas".
  assert.match(layout, /alertsUnknown/)
  assert.match(layout, /alertsLoadedOk === false/)
})

test('Dashboard, sino e filas usam a MESMA camada de status operacional', () => {
  assert.match(overview, /from '\.\.\/\.\.\/lib\/adminOperationalStatus'/)
  assert.match(layout, /from '\.\.\/\.\.\/lib\/adminOperationalStatus'/)
  // O total de "precisa de atenção" é deduplicado (ação + falhas técnicas).
  assert.match(shared, /export function attentionTotal/)
  assert.match(shared, /ACTION_QUEUE_KEYS/)
  assert.match(shared, /TECH_FAILURE_KEYS/)
  // O sino (loadAlerts) não re-consulta support_tickets / guidance por conta
  // própria — usa só o snapshot compartilhado.
  const loadAlerts = layout.match(/const loadAlerts = useCallback\(async \(\) => \{[\s\S]*?\n\s{2}\}, \[\]\)/)?.[0] ?? ''
  assert.ok(loadAlerts.length > 0, 'loadAlerts não encontrada')
  assert.match(loadAlerts, /fetchOperationalSnapshot\(\)/)
  assert.doesNotMatch(loadAlerts, /from\('support_tickets'\)/)
  assert.doesNotMatch(loadAlerts, /from\('monthly_guidance_requests'\)/)
})
