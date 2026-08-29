import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260829190000_privacy_preferences_and_function_hardening.sql', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../src/lib/privacyPreferences.ts', import.meta.url), 'utf8')
const privacyControl = readFileSync(new URL('../src/components/HistoryPersonalizationControl.tsx', import.meta.url), 'utf8')
const accountPrivacy = readFileSync(new URL('../src/components/AccountPrivacyControls.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const adaptive = readFileSync(new URL('../src/components/AdaptiveCheckinIntro.tsx', import.meta.url), 'utf8')
const savedReflection = readFileSync(new URL('../src/components/DiarySavedReflection.tsx', import.meta.url), 'utf8')
const exportFunction = readFileSync(new URL('../supabase/functions/export-user-data/index.ts', import.meta.url), 'utf8')

test('preferência de histórico é própria do usuário e protegida por RLS', () => {
  assert.match(migration, /create table if not exists public\.user_privacy_preferences/i)
  assert.match(migration, /history_personalization_enabled boolean not null default true/i)
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /auth\.uid\(\)\) = user_id/i)
  assert.match(migration, /revoke all on table public\.user_privacy_preferences from anon/i)
  assert.match(migration, /grant select, insert, update on table public\.user_privacy_preferences to authenticated/i)
})

test('callbacks de trigger deixam de ser RPCs expostas e search_path fica fixo', () => {
  assert.match(migration, /p\.prorettype = 'pg_catalog\.trigger'::regtype/i)
  assert.match(migration, /revoke all on function %s from public, anon, authenticated/i)
  assert.match(migration, /alter function public\.set_updated_at\(\) set search_path = public, pg_temp/i)
  assert.match(migration, /alter function public\.touch_updated_at\(\) set search_path = public, pg_temp/i)
  assert.match(migration, /alter function public\.update_support_updated_at\(\) set search_path = public, pg_temp/i)
  assert.match(migration, /alter function public\.set_user_subscription_plan_activated_at\(\) set search_path = public, pg_temp/i)
})

test('RPCs de conta continuam autenticadas, mas perdem execução anônima', () => {
  assert.match(migration, /revoke execute on function public\.clear_must_change_password\(\) from anon/i)
  assert.match(migration, /revoke execute on function public\.mark_personalized_content_as_read\(uuid\) from anon/i)
  assert.match(migration, /revoke execute on function public\.touch_last_seen\(\) from anon/i)
  assert.match(migration, /revoke execute on function public\.update_my_profile\(text, text, text, text, text, text\) from anon/i)
  assert.doesNotMatch(migration, /revoke execute on function public\.update_my_profile[^;]+from authenticated/i)
})

test('controle é reversível e não apaga nem bloqueia áreas manuais', () => {
  assert.match(helper, /history_personalization_enabled/)
  assert.match(helper, /\.upsert\(/)
  assert.match(privacyControl, /Retomadas automáticas com meu histórico/)
  assert.match(privacyControl, /Desativar não apaga seus registros/)
  assert.match(privacyControl, /não bloqueia Mapa Emocional, Relatórios ou Minha História/)
  assert.match(accountPrivacy, /<HistoryPersonalizationControl user=\{user\} \/>/)
})

test('Home pausa retomada, descoberta e sugestões automáticas quando a preferência está desligada', () => {
  assert.match(home, /fetchHistoryPersonalizationEnabled\(user\.id\)/)
  assert.match(home, /historyEnabled \? buildHomeDiscovery/)
  assert.match(home, /historyEnabled \? buildContinuityPrompt/)
  assert.match(home, /entries=\{historyPersonalizationEnabled \? homeEntries : \[\]\}/)
  assert.match(home, /Sugestões automáticas pausadas/)
  assert.match(home, /Explorar conteúdos/)
})

test('check-in adaptativo e recorrência pós-Diário respeitam a preferência', () => {
  assert.match(adaptive, /fetchHistoryPersonalizationEnabled\(user\.id\)/)
  assert.match(adaptive, /if \(!historyEnabled\)/)
  assert.match(savedReflection, /fetchHistoryPersonalizationEnabled\(user\.id\)/)
  assert.match(savedReflection, /if \(!historyEnabled\)/)
})

test('preferência nova entra na exportação de dados do usuário', () => {
  assert.match(exportFunction, /fetchAll\('user_privacy_preferences', 'history_personalization_enabled,updated_at'\)/)
  assert.match(exportFunction, /privacy_preferences: privacyPreferences/)
})

test('controle não reintroduz linguagem técnica de provedor nem gamificação', () => {
  assert.doesNotMatch(privacyControl, /OpenAI|Anthropic|Gemini|GPT|Claude/i)
  assert.doesNotMatch(privacyControl, /streak|ranking|sementes|xp|recompensa/i)
})
