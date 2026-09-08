import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907270000_feature_flags.sql')
const lib = read('src/lib/featureFlags.ts')
const comp = read('src/components/admin/AdminFeatureFlags.tsx')
const area = read('src/components/admin/AdminAreaSistema.tsx')

test('a flag tem os 5 modos pedidos e só é escrita via RPC', () => {
  assert.match(migration, /check \(mode in \('off','admins','beta','percentage','on'\)\)/i)
  assert.match(migration, /revoke insert, update, delete on public\.feature_flags from authenticated, anon/i)
  assert.match(migration, /create policy feature_flags_admin_read on public\.feature_flags\s*\n\s*for select/i)
})

test('flags críticas (auth/cobrança/webhook/integridade) nascem protegidas', () => {
  assert.match(migration, /feature_flag_is_critical/i)
  assert.match(migration, /\^\(auth\|login\|mfa\|billing\|payment\|checkout\|subscription\|webhook\|stripe\|data_integrity\|rls\)/i)
})

test('desligar uma flag protegida exige p_force (não desliga login/cobrança sem querer)', () => {
  assert.match(migration, /if v_protected and v_mode in \('off','admins'\) and not coalesce\(p_force, false\) then/i)
  assert.match(migration, /raise exception 'flag protegida/i)
  assert.match(comp, /window\.prompt\('Digite DESLIGAR para confirmar:'\) === 'DESLIGAR'/)
})

test('a avaliação é server-side, estável por usuário e respeita plano/ambiente/allow-list', () => {
  assert.match(migration, /create or replace function public\.feature_flag_enabled\(/i)
  assert.match(migration, /create or replace function public\.get_active_feature_flags\(/i)
  assert.match(migration, /if v_uid is not null and v_uid = any\(f\.user_ids\) then\s*\n\s*return true/i)
  assert.match(migration, /feature_flag_bucket\(p_key, v_uid\) < f\.percentage/i)
  assert.match(migration, /not \(p_env = any\(f\.environments\)\)/i)
})

test('a lib do cliente é falha-segura e a área Sistema ganha a aba', () => {
  assert.match(lib, /supabase\.rpc\('get_active_feature_flags'/)
  assert.match(lib, /return cache/)
  assert.match(lib, /export function isFeatureEnabled/)
  assert.match(area, /id: 'flags', label: 'Feature flags', Component: AdminFeatureFlags/)
})

test('a escrita passa por admin_can(system,operate) e é auditada', () => {
  assert.match(migration, /if not public\.admin_can\('system','operate'\) then/i)
  assert.match(comp, /logAdminAction\('config', 'feature_flag'/)
})
