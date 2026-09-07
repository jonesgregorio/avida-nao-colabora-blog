import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907220000_admin_journey_funnel.sql')
const comp = read('src/components/admin/AdminJourneyFunnel.tsx')
const page = read('src/components/admin/AnalyticsPage.tsx')

test('a RPC do funil de ativação é admin-only e não exposta a anon', () => {
  assert.match(migration, /create or replace function public\.admin_journey_funnel\(/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /if not public\.is_admin\(\) then\s*\n\s*raise exception 'not authorized'/i)
  assert.match(migration, /revoke all on function public\.admin_journey_funnel\(integer\) from public, anon/i)
})

test('o funil cobre os 7 passos da jornada por coorte de cadastro', () => {
  for (const k of ['signed_up', 'first_checkin', 'first_diary', 'first_questionnaire', 'first_report', 'first_care_plan', 'recurring_use']) {
    assert.match(migration, new RegExp(`'${k}'`), `passo ${k} ausente`)
  }
  assert.match(migration, /from public\.profiles p\s*\n\s*where p\.created_at >= v_since/i)
})

test('não recria retenção, funil comercial nem financeiro', () => {
  assert.doesNotMatch(migration, /create or replace function public\.get_retention_continuity_analytics/i)
  assert.doesNotMatch(migration, /create or replace function public\.get_operational_metrics/i)
  // A tela aponta para os painéis existentes em vez de duplicá-los.
  assert.match(comp, /Financeiro/)
  assert.match(comp, /Retenção D1\/D7\/D30/)
})

test('a conversão de planos vem de subscription_events reais', () => {
  assert.match(migration, /from public\.subscription_events/i)
  for (const k of ['free_to_paid', 'upgrades', 'downgrades', 'cancellations_completed', 'reactivations']) {
    assert.match(migration, new RegExp(`'${k}'`), `métrica ${k} ausente`)
  }
})

test('a tela degrada e entra na página de Analytics', () => {
  assert.match(comp, /admin_journey_funnel\|does not exist\|schema cache/)
  assert.match(comp, /disponível após o deploy desta etapa/i)
  assert.match(page, /<AdminJourneyFunnel \/>/)
})
