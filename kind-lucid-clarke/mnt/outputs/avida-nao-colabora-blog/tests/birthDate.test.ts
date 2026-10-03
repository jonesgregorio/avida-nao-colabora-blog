import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').split('\r\n').join('\n')
const migration = read('supabase/migrations/20261003120000_birth_date.sql')

test('migration: coluna opcional, escrita só pela RPC validada do próprio usuário', () => {
  assert.match(migration, /add column if not exists birth_date date/)
  assert.match(migration, /p_birth_date\s+date default null/)
  assert.match(migration, /Data de nascimento inválida/)
  assert.match(migration, /where user_id = auth\.uid\(\)/)
  assert.match(migration, /revoke execute on function public\.update_my_profile\(text, text, text, text, text, text, date, boolean\) from public, anon/)
})

test('migration: idade calculada no servidor no fuso de São Paulo, nas telas de Usuários e Engajamento', () => {
  assert.match(migration, /function public\.admin_list_users_v2/)
  assert.match(migration, /function public\.admin_engagement_base/)
  assert.match(migration, /function public\.get_user_engagement_page/)
  assert.equal((migration.match(/America\/Sao_Paulo/g) ?? []).length >= 4, true)
  assert.match(migration, /revoke all on function public\.admin_engagement_base\(\) from public, anon, authenticated/)
})

test('migration: alerta de aniversário é idempotente por pessoa/ano, trata 29/02 e é agendado 1x por dia', () => {
  assert.match(migration, /'user_birthday:' \|\| r\.user_id \|\| ':' \|\| v_year/)
  assert.match(migration, /extract\(day from p\.birth_date\) = 29/)
  assert.match(migration, /cron\.schedule\('admin-birthday-alerts', '0 11 \* \* \*'/)
  assert.match(migration, /revoke all on function public\.admin_birthday_alerts\(\) from public, anon, authenticated/)
})

test('Minha Conta envia a data (ou pede para limpar) pela RPC update_my_profile', () => {
  const profile = read('src/components/Profile.tsx')
  assert.match(profile, /type="date"/)
  assert.match(profile, /p_birth_date: birthDate \|\| null/)
  assert.match(profile, /p_clear_birth_date: !birthDate && !!profile\?\.birth_date/)
})

test('Admin mostra o aniversário no sino com texto e ícone próprios', () => {
  const copy = read('src/lib/adminActivityEvents.ts')
  assert.match(copy, /case 'user_birthday'/)
  assert.ok(copy.includes('faz ${age} anos hoje'))
  const alerts = read('src/components/admin/AdminActivityAlerts.tsx')
  assert.match(alerts, /ev.event_type === 'user_birthday'/)
  assert.match(alerts, /<Cake /)
})
