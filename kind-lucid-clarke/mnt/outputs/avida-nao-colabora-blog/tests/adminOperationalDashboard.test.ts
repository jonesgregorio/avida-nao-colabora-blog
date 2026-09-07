import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260907170000_admin_operational_dashboard.sql')
const dash = read('src/components/admin/AdminOperationalDashboard.tsx')
const overview = read('src/components/admin/AdminOverview.tsx')

test('RPC admin_operational_dashboard é admin-only, com período, e não toca get_operational_metrics', () => {
  assert.match(migration, /create or replace function public\.admin_operational_dashboard\(\s*\n?\s*p_start timestamptz,\s*\n?\s*p_end\s+timestamptz/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /if p_start is null or p_end is null or p_end <= p_start then/i)
  // Não redefine a função da Saúde do Sistema.
  assert.doesNotMatch(migration, /create or replace function public\.get_operational_metrics/i)
  assert.match(migration, /revoke all on function public\.admin_operational_dashboard\(timestamptz, timestamptz\) from public, anon/i)
})

test('a RPC devolve período + bloco "requer atenção" e só agrega (sem dados pessoais)', () => {
  assert.match(migration, /'period', jsonb_build_object/)
  assert.match(migration, /'attention', jsonb_build_object/)
  for (const k of ['active_users', 'new_users', 'checkins', 'diary_entries', 'reports_generated', 'new_subscriptions', 'cancellations', 'payments_failed']) {
    assert.match(migration, new RegExp(`'${k}'`), `métrica ${k} ausente`)
  }
  for (const k of ['reports_failed', 'tickets_stale_7d', 'guidance_pending', 'notifications_draft']) {
    assert.match(migration, new RegExp(`'${k}'`), `alerta ${k} ausente`)
  }
  assert.doesNotMatch(migration, /\.text|free_note|content_html|full_name|email\b/i)
})

test('a Central da Jornada tem seletor de período e degrada com segurança', () => {
  assert.match(dash, /'today' \| '7d' \| '30d' \| 'month' \| 'custom'/)
  assert.match(dash, /supabase\.rpc\('admin_operational_dashboard'/)
  assert.match(dash, /admin_operational_dashboard\|does not exist\|schema cache/)
  assert.match(dash, /Requer atenção/)
  assert.match(dash, /period === 'custom'/)
})

test('a Central da Jornada é renderizada na Visão geral, sem remover o que já existia', () => {
  assert.match(overview, /import AdminOperationalDashboard from '\.\/AdminOperationalDashboard'/)
  assert.match(overview, /<AdminOperationalDashboard onNavigate=\{onNavigate\} \/>/)
  // Seções antigas preservadas.
  assert.match(overview, /Fila de atenção/)
  assert.match(overview, /Atividade recente/)
  assert.match(overview, /Saúde do sistema/)
})
