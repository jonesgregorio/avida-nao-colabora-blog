import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907170000_admin_operational_dashboard.sql')
const hotfix = read('supabase/migrations/20260907290000_fix_operational_dashboard_notifications.sql')
const dash = read('src/components/admin/AdminOperationalDashboard.tsx')
const overview = read('src/components/admin/AdminOverview.tsx')

test('RPC admin_operational_dashboard é admin-only, com período, e não toca get_operational_metrics', () => {
  assert.match(migration, /create or replace function public\.admin_operational_dashboard\(\s*\n?\s*p_start timestamptz,\s*\n?\s*p_end\s+timestamptz/i)
  assert.match(migration, /security definer/i); assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /if p_start is null or p_end is null or p_end <= p_start then/i)
  assert.doesNotMatch(migration, /create or replace function public\.get_operational_metrics/i)
  assert.match(migration, /revoke all on function public\.admin_operational_dashboard\(timestamptz, timestamptz\) from public, anon/i)
})

test('a RPC devolve período + bloco "requer atenção" e só agrega (sem dados pessoais)', () => {
  assert.match(migration, /'period', jsonb_build_object/); assert.match(migration, /'attention', jsonb_build_object/)
  for (const k of ['active_users', 'new_users', 'checkins', 'diary_entries', 'reports_generated', 'new_subscriptions', 'cancellations', 'payments_failed']) assert.match(migration, new RegExp(`'${k}'`), `métrica ${k} ausente`)
  for (const k of ['reports_failed', 'tickets_stale_7d', 'guidance_pending', 'notifications_draft']) assert.match(migration, new RegExp(`'${k}'`), `alerta ${k} ausente`)
  assert.doesNotMatch(migration, /\.text|free_note|content_html|full_name|email\b/i)
})

test('hotfix: notifications_draft não usa notifications.status (coluna inexistente em prod)', () => {
  assert.match(hotfix, /create or replace function public\.admin_operational_dashboard\(/i)
  assert.match(hotfix, /'notifications_draft', \(\s*\n\s*select count\(\*\) from public\.admin_communications where status = 'draft'/i)
  assert.doesNotMatch(hotfix, /from public\.notifications\s*\n\s*where coalesce\(status/i)
  assert.match(hotfix, /grant execute on function public\.admin_operational_dashboard\(timestamptz, timestamptz\) to authenticated/i)
})

test('Central da Jornada é compacta, segmentada e sem duplicar o bloco de atenção', () => {
  assert.match(dash, /'today' \| '7d' \| '30d' \| 'month' \| 'custom'/)
  assert.match(dash, /supabase\.rpc\('admin_operational_dashboard'/)
  assert.doesNotMatch(dash, /após o deploy desta etapa|ficam disponíveis após/)
  assert.match(dash, /code === 'PGRST202'/); assert.match(dash, /period === 'custom'/)
  assert.match(dash, /animate-pulse/); assert.match(dash, /typeof raw === 'number'/)
  assert.match(dash, /const FOCUS =/); assert.match(dash, /Plano de Autocuidado/)
  assert.match(dash, /Participação/); assert.match(dash, /Conteúdo e suporte/); assert.match(dash, /Negócio/)
  assert.doesNotMatch(dash, /Prioridade operacional/)
  assert.doesNotMatch(dash, /<h3[^>]*>Requer atenção/)
})

test('Visão geral tem hierarquia editorial 12 colunas e elimina repetição visual', () => {
  assert.match(overview, /import AdminOperationalDashboard from '\.\/AdminOperationalDashboard'/)
  assert.match(overview, /<AdminOperationalDashboard onNavigate=\{onNavigate\} \/>/)
  assert.match(overview, /max-w-\[1500px\]/)
  assert.match(overview, /xl:grid-cols-12/)
  assert.match(overview, /xl:col-span-8/)
  assert.match(overview, /xl:col-span-4/)
  assert.match(overview, /Painel administrativo/)
  assert.match(overview, /Resumo operacional/)
  assert.match(overview, /Ver todas as pendências/)
  assert.match(overview, /before:absolute/)
  assert.doesNotMatch(overview, /Ir para todas as pendências/)
  assert.match(overview, /Requer ação/); assert.match(overview, /Falhas técnicas ativas/); assert.match(overview, /Atividade recente/); assert.match(overview, /Saúde do sistema/)
})
