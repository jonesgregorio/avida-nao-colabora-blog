import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907190000_admin_cron_controls.sql')
const comp = read('src/components/admin/AdminAutomationsHealth.tsx')

test('RPCs de controle de cron são admin-only e não expostas a anon', () => {
  assert.match(migration, /create or replace function public\.admin_set_cron_active\(/i)
  assert.match(migration, /create or replace function public\.admin_cron_run_history\(/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /revoke all on function public\.admin_set_cron_active\(text, boolean\) from public, anon/i)
  assert.match(migration, /revoke all on function public\.admin_cron_run_history\(text, integer\) from public, anon/i)
})

test('pausar/ativar usa cron.alter_job e NÃO reagenda nem executa o job', () => {
  assert.match(migration, /perform cron\.alter_job\(v_jobid, active := p_active\)/i)
  assert.doesNotMatch(migration, /net\.http_post|cron\.schedule\(/i)
  // Não redefine a função de status já existente.
  assert.doesNotMatch(migration, /create or replace function public\.get_cron_automations_status/i)
})

test('o histórico só devolve metadados de execução (nada de segredo/token)', () => {
  assert.match(migration, /'status', drd\.status/)
  assert.match(migration, /'duration_seconds'/)
  assert.match(migration, /case when drd\.status = 'failed' then drd\.return_message else null end/i)
  assert.doesNotMatch(migration, /command|jobname := |authorization|bearer/i)
})

test('a Central de Automações tem pausar/ativar auditado + histórico expansível', () => {
  assert.match(comp, /supabase\.rpc\('admin_set_cron_active'/)
  assert.match(comp, /supabase\.rpc\('admin_cron_run_history'/)
  assert.match(comp, /logAdminAction\('config', next \? 'automation_resume' : 'automation_pause'/)
  assert.match(comp, /humanSchedule/)
  assert.match(comp, /Últimas 30/)
})
