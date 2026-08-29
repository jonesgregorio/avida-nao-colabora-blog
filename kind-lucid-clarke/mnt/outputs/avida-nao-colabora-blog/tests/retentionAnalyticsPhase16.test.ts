import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260829194000_retention_continuity_analytics.sql', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../src/lib/retentionAnalytics.ts', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiarySavedReflection.tsx', import.meta.url), 'utf8')
const discovery = readFileSync(new URL('../src/components/HomeDiscoveryCard.tsx', import.meta.url), 'utf8')
const smallAction = readFileSync(new URL('../src/components/TodaySmallActionCard.tsx', import.meta.url), 'utf8')
const weeklyFocus = readFileSync(new URL('../src/components/WeeklyFocusCard.tsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/components/admin/AdminRetentionAnalytics.tsx', import.meta.url), 'utf8')
const analyticsPage = readFileSync(new URL('../src/components/admin/AnalyticsPage.tsx', import.meta.url), 'utf8')

test('RPC de retenção é agregada, admin-only e com permissões explícitas', () => {
  assert.match(migration, /create or replace function public\.get_retention_continuity_analytics\(p_days integer default 90\)/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /set search_path = public, pg_temp/i)
  assert.match(migration, /if not public\.is_admin\(\)/i)
  assert.match(migration, /revoke all on function public\.get_retention_continuity_analytics\(integer\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.get_retention_continuity_analytics\(integer\) to authenticated/i)
})

test('retenção usa dias distintos, fuso do produto e retorno após pausa sem streak', () => {
  assert.match(migration, /America\/Sao_Paulo/)
  assert.match(migration, /select distinct user_id, activity_day/i)
  assert.match(migration, /lag\(activity_day\) over \(partition by user_id order by activity_day\)/i)
  assert.match(migration, /activity_day - o\.previous_day\) >= 4/i)
  assert.match(migration, /repeat_7/i)
  assert.match(migration, /repeat_30/i)
  assert.doesNotMatch(migration, /\bstreak\b/i)
})

test('D1, D7 e D30 são retenção rolante e respeitam início real da medição', () => {
  assert.match(migration, /tracking_since/i)
  assert.match(migration, /ep\.signup_day >= t\.tracking_since/i)
  assert.match(migration, /activity_day >= retention_base\.signup_day \+ 1/i)
  assert.match(migration, /activity_day >= retention_base\.signup_day \+ 7/i)
  assert.match(migration, /activity_day >= retention_base\.signup_day \+ 30/i)
  assert.match(migration, /case when r1\.eligible = 0 then null/i)
  assert.match(migration, /case when r7\.eligible = 0 then null/i)
  assert.match(migration, /case when r30\.eligible = 0 then null/i)
})

test('agregação não consulta conteúdo emocional ou texto do Diário', () => {
  assert.doesNotMatch(migration, /\bdiary_entries\b/i)
  assert.doesNotMatch(migration, /\b(?:mood|anxiety_level|sleep_quality|stress_level|overload|trigger_tags|emotional_tags|need_tags|care_action_tags|free_note|diary_text)\b/i)
  assert.match(migration, /from public\.analytics_events/i)
  assert.match(migration, /coalesce\(p\.role, 'user'\) <> 'admin'/i)
})

test('helper de retenção aceita somente metadados categóricos seguros', () => {
  assert.match(helper, /new Set\(\['surface', 'status', 'source'\]\)/)
  assert.match(helper, /analytics_scope: 'retention'/)
  assert.match(helper, /trackEvent\(event, \{/)
  assert.doesNotMatch(helper, /entity_title:/)
  assert.doesNotMatch(helper, /entity_id:/)
  assert.doesNotMatch(helper, /\b(?:mood|anxiety|trigger|emotion|need|focus_title|discovery_title|diary_text|outcome)\b/i)
})

test('pontos principais registram somente a ação de produto', () => {
  assert.match(diary, /'checkin_complete' : 'diary_entry'/)
  assert.match(diary, /trackRetentionEvent\('diary_pattern_view'/)
  assert.match(discovery, /trackRetentionEvent\('discovery_view'/)
  assert.match(discovery, /trackRetentionEvent\('discovery_open'/)
  assert.match(smallAction, /trackRetentionEvent\('small_action_accepted'/)
  assert.match(smallAction, /trackRetentionEvent\('small_action_completed'/)
  assert.match(weeklyFocus, /trackRetentionEvent\('weekly_focus_saved'/)
  assert.match(weeklyFocus, /trackRetentionEvent\('weekly_focus_reflected'/)
  assert.doesNotMatch(weeklyFocus, /metadata:\s*\{[^}]*outcome/s)
  assert.doesNotMatch(weeklyFocus, /metadata:\s*\{[^}]*focus_title/s)
  assert.doesNotMatch(discovery, /metadata:\s*\{[^}]*discovery\.(?:title|description|evidence|question)/s)
})

test('painel admin explica base insuficiente e privacidade da métrica', () => {
  assert.match(dashboard, /Retenção e continuidade/)
  assert.match(dashboard, /Sem base ainda/)
  assert.match(dashboard, /Retenção rolante/)
  assert.match(dashboard, /Voltaram após uma pausa/)
  assert.match(dashboard, /Métrica de comportamento, não de conteúdo emocional/)
  assert.match(dashboard, /Não consulta texto livre do Diário, humor, ansiedade, gatilhos, emoções, necessidades, títulos de foco, conteúdo de descobertas ou respostas pessoais/)
  assert.match(analyticsPage, /<AdminRetentionAnalytics \/>/)
})
