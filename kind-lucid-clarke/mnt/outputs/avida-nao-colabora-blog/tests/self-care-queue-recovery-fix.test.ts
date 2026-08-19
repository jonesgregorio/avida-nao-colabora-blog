import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260819235000_self_care_queue_recovery_fix.sql', import.meta.url),
  'utf8',
)

test('recuperação usa operações JSONB compatíveis com o banco live', () => {
  assert.doesNotMatch(migration, /jsonb_object_length/)
  assert.match(migration, /COALESCE\(ai_summary_json, '\{\}'::jsonb\) = '\{\}'::jsonb/)
  assert.match(migration, /COALESCE\(care_plan, '\{\}'::jsonb\) = '\{\}'::jsonb/)
})

test('limpeza fica limitada ao último mês fechado', () => {
  assert.match(migration, /month_reference = date_trunc/)
  assert.match(migration, /interval '1 month'/)
  assert.match(migration, /America\/Sao_Paulo/)
})

test('hotfix mantém o mesmo cron e a mesma Edge Function', () => {
  assert.match(migration, /cron\.alter_job/)
  assert.match(migration, /run-emotional-automations/)
  assert.match(migration, /net\.http_post/)
})
